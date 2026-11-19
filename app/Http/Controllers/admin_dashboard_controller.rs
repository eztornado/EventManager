use std::collections::{BTreeMap, HashMap};

use chrono::{Duration, Utc};
use larust_support::axum::extract::Query;
use larust_support::axum::Json;
use larust_support::orm::sqlx;
use larust_support::serde_json::{json, Value};

use crate::models::{Club, Coupon, EventRow, Gift, Modality, Registration};
use crate::services::auth::CurrentUser;
use crate::services::ApiError;

pub async fn dashboard(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let mut events: Vec<EventRow> = sqlx::query_as("SELECT * FROM events ORDER BY start_date ASC")
        .fetch_all(pool)
        .await?;
    if user.is_organizer() {
        events.retain(|event| event.organizer_id == user.organizer_id);
    }
    if let Some(event_id) = params.get("eventId").and_then(|value| value.parse::<i64>().ok()) {
        events.retain(|event| event.id == event_id);
    }
    let event_ids: Vec<i64> = events.iter().map(|event| event.id).collect();
    let event_names: HashMap<i64, String> = events
        .iter()
        .map(|event| (event.id, event.name.clone()))
        .collect();

    let modalities: Vec<Modality> = sqlx::query_as("SELECT * FROM modalities")
        .fetch_all(pool)
        .await?;
    let modality_names: HashMap<i64, String> = modalities
        .iter()
        .map(|modality| (modality.id, modality.name.clone()))
        .collect();
    let event_modalities: HashMap<i64, Vec<&Modality>> = {
        let mut map: HashMap<i64, Vec<&Modality>> = HashMap::new();
        for modality in &modalities {
            map.entry(modality.event_id).or_default().push(modality);
        }
        map
    };

    let registrations: Vec<Registration> = sqlx::query_as("SELECT * FROM registrations")
        .fetch_all(pool)
        .await?
        .into_iter()
        .filter(|registration: &Registration| event_ids.contains(&registration.event_id))
        .collect();
    let gifts: Vec<Gift> = sqlx::query_as("SELECT * FROM gifts")
        .fetch_all(pool)
        .await?
        .into_iter()
        .filter(|gift: &Gift| event_ids.contains(&gift.event_id))
        .collect();
    let coupons: Vec<Coupon> = sqlx::query_as("SELECT * FROM coupons")
        .fetch_all(pool)
        .await?
        .into_iter()
        .filter(|coupon: &Coupon| coupon.event_id.is_none_or(|id| event_ids.contains(&id)))
        .collect();
    let clubs: Vec<Club> = sqlx::query_as("SELECT * FROM clubs")
        .fetch_all(pool)
        .await?;

    let active: Vec<&Registration> = registrations
        .iter()
        .filter(|registration| registration.status != "cancelled")
        .collect();
    let paid: Vec<&Registration> = registrations
        .iter()
        .filter(|registration| registration.status == "paid")
        .collect();
    let pending: Vec<&Registration> = registrations
        .iter()
        .filter(|registration| registration.status == "pending")
        .collect();
    let cancelled: Vec<&Registration> = registrations
        .iter()
        .filter(|registration| registration.status == "cancelled")
        .collect();

    let revenue: f64 = paid.iter().map(|registration| registration.total).sum();
    let pending_amount: f64 = pending.iter().map(|registration| registration.total).sum();

    let by_gender = group_registrations(&active, &|registration| {
        if registration.gender.is_empty() {
            "Sin indicar".to_string()
        } else {
            registration.gender.clone()
        }
    });
    let by_province = group_registrations(&active, &|registration| {
        if registration.province.is_empty() {
            "Sin provincia".to_string()
        } else {
            registration.province.clone()
        }
    });
    let by_country = group_registrations(&active, &|registration| {
        if registration.country.is_empty() {
            "Sin país".to_string()
        } else {
            registration.country.clone()
        }
    });
    let by_club = group_registrations(&active, &|registration| {
        if registration.club_name.is_empty() {
            "Sin club".to_string()
        } else {
            registration.club_name.clone()
        }
    });
    let by_modality = group_registrations(&active, &|registration| {
        let modality = modality_names
            .get(&registration.modality_id)
            .cloned()
            .unwrap_or_else(|| "Sin modalidad".to_string());
        let event = event_names
            .get(&registration.event_id)
            .cloned()
            .unwrap_or_default();
        format!("{} · {}", event, modality)
    });
    let by_status = vec![
        json!({ "name": "Pagada", "count": paid.len() }),
        json!({ "name": "Pendiente de pago", "count": pending.len() }),
        json!({ "name": "Cancelada", "count": cancelled.len() }),
    ];

    // Registrations per day, last 30 days, zero-filled.
    let mut daily: BTreeMap<String, i64> = BTreeMap::new();
    let today = Utc::now().date_naive();
    for offset in (0..30).rev() {
        let date = today - Duration::days(offset);
        daily.insert(date.format("%Y-%m-%d").to_string(), 0);
    }
    for registration in &active {
        if let Some(day) = registration.created_at.get(0..10) {
            if let Some(value) = daily.get_mut(day) {
                *value += 1;
            }
        }
    }
    let over_time: Vec<Value> = daily
        .into_iter()
        .map(|(date, count)| json!({ "date": date, "count": count }))
        .collect();

    let mut recent: Vec<&Registration> = active.clone();
    recent.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let recent: Vec<Value> = recent
        .into_iter()
        .take(8)
        .map(|registration| {
            json!({
                "id": registration.id,
                "locator": registration.locator,
                "name": format!("{} {}", registration.first_name, registration.last_name),
                "email": registration.email,
                "eventName": event_names.get(&registration.event_id).cloned().unwrap_or_default(),
                "modalityName": modality_names.get(&registration.modality_id).cloned().unwrap_or_default(),
                "status": registration.status,
                "total": registration.total,
                "createdAt": registration.created_at
            })
        })
        .collect();

    let event_rows: Vec<Value> = events
        .iter()
        .map(|event| {
            let registration_count = active
                .iter()
                .filter(|registration| registration.event_id == event.id)
                .count() as i64;
            let event_paid: Vec<&&Registration> = paid
                .iter()
                .filter(|registration| registration.event_id == event.id)
                .collect();
            let paid_count = event_paid.len() as i64;
            let revenue: f64 = event_paid.iter().map(|registration| registration.total).sum();
            let modalities = event_modalities
                .get(&event.id)
                .map(|list| list.len())
                .unwrap_or(0);
            json!({
                "id": event.id,
                "name": event.name,
                "slug": event.slug,
                "status": if modalities == 0 { "Sin modalidades asignadas" } else { event.status.as_str() },
                "startDate": event.start_date,
                "modalityCount": modalities,
                "registrationCount": registration_count,
                "paidCount": paid_count,
                "revenue": revenue,
                "maxParticipants": event.max_participants
            })
        })
        .collect();

    let organizers_count: i64 = if user.is_organizer() {
        if events.is_empty() {
            0
        } else {
            1
        }
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM organizers")
            .fetch_one(pool)
            .await?
    };

    let available_gifts = gifts.iter().filter(|gift| gift.status == "available").count();
    let claimed_gifts = gifts.iter().filter(|gift| gift.status == "claimed").count();
    let pending_gifts = gifts.iter().filter(|gift| gift.status == "pending").count();
    let coupon_uses: i64 = coupons.iter().map(|coupon| coupon.uses).sum();

    Ok(Json(json!({
        "totals": {
            "events": events.len(),
            "activeEvents": events.iter().filter(|event| event.status == "Inscripciones abiertas").count(),
            "registrations": active.len(),
            "paid": paid.len(),
            "pending": pending.len(),
            "cancelled": cancelled.len(),
            "revenue": revenue,
            "pendingAmount": pending_amount,
            "gifts": gifts.len(),
            "availableGifts": available_gifts,
            "claimedGifts": claimed_gifts,
            "pendingGifts": pending_gifts,
            "coupons": coupons.len(),
            "couponUses": coupon_uses,
            "clubs": clubs.len(),
            "organizers": organizers_count
        },
        "byStatus": by_status,
        "byGender": by_gender,
        "byProvince": by_province,
        "byCountry": by_country,
        "byClub": by_club,
        "byModality": by_modality,
        "overTime": over_time,
        "recentRegistrations": recent,
        "events": event_rows
    })))
}

fn group_registrations(
    active: &[&Registration],
    key: &dyn Fn(&&Registration) -> String,
) -> Vec<Value> {
    let mut map: HashMap<String, i64> = HashMap::new();
    for registration in active {
        *map.entry(key(registration)).or_insert(0) += 1;
    }
    let mut items: Vec<(String, i64)> = map.into_iter().collect();
    items.sort_by(|a, b| b.1.cmp(&a.1));
    items
        .into_iter()
        .map(|(name, count)| json!({ "name": name, "count": count }))
        .collect()
}
