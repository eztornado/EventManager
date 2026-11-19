use std::collections::HashMap;

use larust_support::axum::extract::{Path, Query};
use larust_support::axum::response::IntoResponse;
use larust_support::axum::Json;
use larust_support::orm::sqlx;
use larust_support::serde_json::{json, Value};

use crate::models::{
    AdminUser, Club, Coupon, EmailOutbox, EventRow, Gift, Modality, Order, Organizer,
    OrganizerAccount, Registration,
};
use crate::services::auth::{hash_password, CurrentUser};
use crate::services::email;
use crate::services::util::{csv_escape, is_valid_email, now_iso, slugify};
use crate::services::ApiError;

fn body_str(body: &Value, key: &str) -> String {
    body.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn body_opt_str(body: &Value, key: &str) -> Option<String> {
    body.get(key).map(|_| body_str(body, key))
}

fn body_bool(body: &Value, key: &str) -> Option<bool> {
    body.get(key).and_then(|value| {
        value
            .as_bool()
            .or_else(|| value.as_i64().map(|number| number != 0))
    })
}

async fn scoped_event_ids(user: &CurrentUser) -> Result<Vec<i64>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let ids: Vec<i64> = if user.is_organizer() {
        sqlx::query_scalar("SELECT id FROM events WHERE organizer_id = ?")
            .bind(user.organizer_id)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_scalar("SELECT id FROM events")
            .fetch_all(pool)
            .await?
    };
    Ok(ids)
}

async fn event_map() -> Result<HashMap<i64, EventRow>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let events: Vec<EventRow> = sqlx::query_as("SELECT * FROM events").fetch_all(pool).await?;
    Ok(events.into_iter().map(|event| (event.id, event)).collect())
}

async fn modality_map() -> Result<HashMap<i64, Modality>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let modalities: Vec<Modality> = sqlx::query_as("SELECT * FROM modalities").fetch_all(pool).await?;
    Ok(modalities
        .into_iter()
        .map(|modality| (modality.id, modality))
        .collect())
}

async fn filtered_registrations(
    user: &CurrentUser,
    params: &HashMap<String, String>,
) -> Result<Vec<Registration>, ApiError> {
    let event_ids = scoped_event_ids(user).await?;
    let pool = larust_support::orm::pool()?;
    let mut registrations: Vec<Registration> =
        sqlx::query_as("SELECT * FROM registrations ORDER BY id DESC")
            .fetch_all(pool)
            .await?
            .into_iter()
            .filter(|registration: &Registration| event_ids.contains(&registration.event_id))
            .collect();
    if let Some(event_id) = params.get("eventId").and_then(|value| value.parse::<i64>().ok()) {
        registrations.retain(|registration| registration.event_id == event_id);
    }
    if let Some(modality_id) = params
        .get("modalityId")
        .and_then(|value| value.parse::<i64>().ok())
    {
        registrations.retain(|registration| registration.modality_id == modality_id);
    }
    if let Some(status) = params.get("status") {
        if !status.is_empty() {
            registrations.retain(|registration| &registration.status == status);
        }
    }
    if let Some(search) = params.get("search") {
        let search = search.to_lowercase();
        registrations.retain(|registration| {
            registration.locator.to_lowercase().contains(&search)
                || registration.email.to_lowercase().contains(&search)
                || registration
                    .first_name
                    .to_lowercase()
                    .contains(&search)
                || registration.last_name.to_lowercase().contains(&search)
                || registration.club_name.to_lowercase().contains(&search)
        });
    }
    if let Some(from) = params.get("from") {
        if !from.is_empty() {
            registrations.retain(|registration| registration.created_at.get(0..10) >= Some(from.as_str()));
        }
    }
    if let Some(to) = params.get("to") {
        if !to.is_empty() {
            registrations.retain(|registration| registration.created_at.get(0..10) <= Some(to.as_str()));
        }
    }
    Ok(registrations)
}

async fn registration_json(
    registration: &Registration,
    events: &HashMap<i64, EventRow>,
    modalities: &HashMap<i64, Modality>,
) -> Result<Value, ApiError> {
    let pool = larust_support::orm::pool()?;
    let order: Option<Order> = sqlx::query_as(
        "SELECT * FROM orders WHERE registration_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(registration.id)
    .fetch_optional(pool)
    .await?;
    let mut value = serde_json::to_value(registration).map_err(ApiError::internal)?;
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "eventName".into(),
            json!(events.get(&registration.event_id).map(|event| event.name.clone())),
        );
        object.insert(
            "eventSlug".into(),
            json!(events.get(&registration.event_id).map(|event| event.slug.clone())),
        );
        object.insert(
            "modalityName".into(),
            json!(modalities
                .get(&registration.modality_id)
                .map(|modality| modality.name.clone())),
        );
        object.insert(
            "dynamicData".into(),
            serde_json::from_str(&registration.dynamic_data).unwrap_or_else(|_| json!({})),
        );
        object.insert("order".into(), serde_json::to_value(order).unwrap_or(Value::Null));
    }
    Ok(value)
}

pub async fn list_registrations(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let registrations = filtered_registrations(&user, &params).await?;
    let events = event_map().await?;
    let modalities = modality_map().await?;
    let mut items = Vec::new();
    for registration in &registrations {
        items.push(registration_json(registration, &events, &modalities).await?);
    }
    Ok(Json(json!(items)))
}

pub async fn get_registration(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let registration: Registration = sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Registration not found."))?;
    user.require_event_access(registration.event_id).await?;
    let events = event_map().await?;
    let modalities = modality_map().await?;
    let mut value = registration_json(&registration, &events, &modalities).await?;
    let coupon: Option<Coupon> = match registration.coupon_id {
        Some(coupon_id) => sqlx::query_as("SELECT * FROM coupons WHERE id = ?")
            .bind(coupon_id)
            .fetch_optional(pool)
            .await?,
        None => None,
    };
    if let Some(object) = value.as_object_mut() {
        object.insert("coupon".into(), serde_json::to_value(coupon).unwrap_or(Value::Null));
        if let Some(event) = events.get(&registration.event_id) {
            object.insert("event".into(), serde_json::to_value(event).unwrap_or(Value::Null));
        }
        if let Some(modality) = modalities.get(&registration.modality_id) {
            let mut modality_value =
                serde_json::to_value(modality).unwrap_or(Value::Null);
            if let Some(object) = modality_value.as_object_mut() {
                object.insert(
                    "dynamicFields".into(),
                    serde_json::from_str(&modality.dynamic_fields)
                        .unwrap_or_else(|_| json!([])),
                );
            }
            object.insert("modality".into(), modality_value);
        }
    }
    Ok(Json(value))
}

pub async fn update_registration(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let registration: Registration = sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Registration not found."))?;
    user.require_event_access(registration.event_id).await?;

    let status = body_opt_str(&body, "status").unwrap_or_else(|| registration.status.clone());
    if !["pending", "paid", "cancelled"].contains(&status.as_str()) {
        return Err(ApiError::bad_request("El estado de la inscripción no es válido."));
    }
    if status == "paid" && registration.status != "paid" {
        let now = now_iso();
        let pending_order: Option<Order> = sqlx::query_as(
            "SELECT * FROM orders WHERE registration_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
        )
        .bind(registration.id)
        .fetch_optional(pool)
        .await?;
        if let Some(order) = pending_order {
            sqlx::query(
                "UPDATE orders SET status = 'completed', reference = ?, paid_at = ? WHERE id = ?",
            )
            .bind(format!("MANUAL-{}", registration.locator))
            .bind(&now)
            .bind(order.id)
            .execute(pool)
            .await?;
        }
        if let Some(coupon_id) = registration.coupon_id {
            sqlx::query("UPDATE coupons SET uses = uses + 1 WHERE id = ?")
                .bind(coupon_id)
                .execute(pool)
                .await?;
        }
    } else if status == "cancelled" && registration.status != "cancelled" {
        sqlx::query("UPDATE orders SET status = 'cancelled' WHERE registration_id = ? AND status = 'pending'")
            .bind(registration.id)
            .execute(pool)
            .await?;
    }

    let club_id = body
        .get("clubId")
        .map(|value| value.as_i64())
        .unwrap_or(registration.club_id);
    let club_name = if let Some(club_id) = club_id {
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM clubs WHERE id = ?")
            .bind(club_id)
            .fetch_optional(pool)
            .await?;
        name.unwrap_or_else(|| body_opt_str(&body, "clubName").unwrap_or_else(|| registration.club_name.clone()))
    } else {
        body_opt_str(&body, "clubName").unwrap_or_else(|| registration.club_name.clone())
    };

    sqlx::query(
        "UPDATE registrations SET first_name = ?, last_name = ?, email = ?, phone = ?,
         birth_date = ?, gender = ?, document_id = ?, province = ?, country = ?, club_id = ?,
         club_name = ?, dynamic_data = ?, status = ?, updated_at = ? WHERE id = ?",
    )
    .bind(body_opt_str(&body, "firstName").unwrap_or_else(|| registration.first_name.clone()))
    .bind(body_opt_str(&body, "lastName").unwrap_or_else(|| registration.last_name.clone()))
    .bind(body_opt_str(&body, "email").map(|email| email.to_lowercase()).unwrap_or_else(|| registration.email.clone()))
    .bind(body_opt_str(&body, "phone").unwrap_or_else(|| registration.phone.clone()))
    .bind(body_opt_str(&body, "birthDate").unwrap_or_else(|| registration.birth_date.clone()))
    .bind(body_opt_str(&body, "gender").unwrap_or_else(|| registration.gender.clone()))
    .bind(body_opt_str(&body, "documentId").unwrap_or_else(|| registration.document_id.clone()))
    .bind(body_opt_str(&body, "province").unwrap_or_else(|| registration.province.clone()))
    .bind(body_opt_str(&body, "country").unwrap_or_else(|| registration.country.clone()))
    .bind(club_id)
    .bind(&club_name)
    .bind(if body.get("dynamicData").is_some() {
        body.get("dynamicData")
            .map(|value| value.to_string())
            .unwrap_or_else(|| registration.dynamic_data.clone())
    } else {
        registration.dynamic_data.clone()
    })
    .bind(&status)
    .bind(now_iso())
    .bind(registration.id)
    .execute(pool)
    .await?;

    let registration: Registration = sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
        .bind(registration.id)
        .fetch_one(pool)
        .await?;
    let events = event_map().await?;
    let modalities = modality_map().await?;
    Ok(Json(registration_json(&registration, &events, &modalities).await?))
}

pub async fn delete_registration(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let registration: Registration = sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Registration not found."))?;
    user.require_event_access(registration.event_id).await?;
    sqlx::query("DELETE FROM registrations WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Inscripción eliminada." })))
}

pub async fn export_registrations(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ApiError> {
    let registrations = filtered_registrations(&user, &params).await?;
    let events = event_map().await?;
    let modalities = modality_map().await?;
    let mut csv = String::from(
        "localizador,evento,modalidad,nombre,apellidos,email,telefono,fecha_nacimiento,genero,documento,provincia,pais,club,estado,importe,creada\n",
    );
    for registration in &registrations {
        let row = [
            registration.locator.clone(),
            events
                .get(&registration.event_id)
                .map(|event| event.name.clone())
                .unwrap_or_default(),
            modalities
                .get(&registration.modality_id)
                .map(|modality| modality.name.clone())
                .unwrap_or_default(),
            registration.first_name.clone(),
            registration.last_name.clone(),
            registration.email.clone(),
            registration.phone.clone(),
            registration.birth_date.clone(),
            registration.gender.clone(),
            registration.document_id.clone(),
            registration.province.clone(),
            registration.country.clone(),
            registration.club_name.clone(),
            registration.status.clone(),
            format!("{:.2}", registration.total),
            registration.created_at.clone(),
        ];
        csv.push_str(
            &row.iter()
                .map(|value| csv_escape(value))
                .collect::<Vec<_>>()
                .join(","),
        );
        csv.push('\n');
    }
    Ok((
        [
            ("content-type", "text/csv; charset=utf-8"),
            ("content-disposition", "attachment; filename=inscripciones.csv"),
        ],
        csv,
    ))
}

// --- Gifts ----------------------------------------------------------------

pub async fn list_gifts(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let event_ids = scoped_event_ids(&user).await?;
    let pool = larust_support::orm::pool()?;
    let mut gifts: Vec<Gift> = sqlx::query_as("SELECT * FROM gifts ORDER BY id DESC")
        .fetch_all(pool)
        .await?
        .into_iter()
        .filter(|gift: &Gift| event_ids.contains(&gift.event_id))
        .collect();
    if let Some(event_id) = params.get("eventId").and_then(|value| value.parse::<i64>().ok()) {
        gifts.retain(|gift| gift.event_id == event_id);
    }
    if let Some(status) = params.get("status") {
        if !status.is_empty() {
            gifts.retain(|gift| &gift.status == status);
        }
    }
    if let Some(search) = params.get("search") {
        let search = search.to_lowercase();
        gifts.retain(|gift| {
            gift.code.to_lowercase().contains(&search)
                || gift.buyer_email.to_lowercase().contains(&search)
                || gift.recipient_email.to_lowercase().contains(&search)
                || gift.recipient_name.to_lowercase().contains(&search)
        });
    }
    let events = event_map().await?;
    let modalities = modality_map().await?;
    let mut items = Vec::new();
    for gift in &gifts {
        let claimed_locator: Option<String> = sqlx::query_scalar(
            "SELECT locator FROM registrations WHERE gift_id = ? LIMIT 1",
        )
        .bind(gift.id)
        .fetch_optional(pool)
        .await?;
        let mut value = serde_json::to_value(gift).map_err(ApiError::internal)?;
        if let Some(object) = value.as_object_mut() {
            object.insert(
                "eventName".into(),
                json!(events.get(&gift.event_id).map(|event| event.name.clone())),
            );
            object.insert(
                "modalityName".into(),
                json!(modalities
                    .get(&gift.modality_id)
                    .map(|modality| modality.name.clone())),
            );
            object.insert("claimedLocator".into(), json!(claimed_locator));
        }
        items.push(value);
    }
    Ok(Json(json!(items)))
}

pub async fn resend_gift(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Gift not found."))?;
    user.require_event_access(gift.event_id).await?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(gift.event_id)
        .fetch_one(pool)
        .await?;
    let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
        .bind(gift.modality_id)
        .fetch_one(pool)
        .await?;
    email::gift_purchased(&gift, &event, &modality.name).await?;
    Ok(Json(json!({ "message": "Correo del regalo reenviado." })))
}

pub async fn delete_gift(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Gift not found."))?;
    user.require_event_access(gift.event_id).await?;
    if gift.status == "claimed" {
        return Err(ApiError::conflict("No se puede eliminar un regalo ya canjeado."));
    }
    sqlx::query("DELETE FROM gifts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Regalo eliminado." })))
}

// --- Orders ---------------------------------------------------------------

pub async fn list_orders(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let event_ids = scoped_event_ids(&user).await?;
    let pool = larust_support::orm::pool()?;
    let orders: Vec<Order> = sqlx::query_as("SELECT * FROM orders ORDER BY id DESC")
        .fetch_all(pool)
        .await?;
    let events = event_map().await?;
    let mut items = Vec::new();
    for order in orders {
        let (event_id, locator, gift_code): (Option<i64>, Option<String>, Option<String>) =
            if let Some(registration_id) = order.registration_id {
                if let Some(row) = sqlx::query_as::<_, (i64, String)>(
                    "SELECT event_id, locator FROM registrations WHERE id = ?",
                )
                .bind(registration_id)
                .fetch_optional(pool)
                .await?
                {
                    (Some(row.0), Some(row.1), None)
                } else {
                    (None, None, None)
                }
            } else if let Some(gift_id) = order.gift_id {
                if let Some(row) = sqlx::query_as::<_, (i64, String)>(
                    "SELECT event_id, code FROM gifts WHERE id = ?",
                )
                .bind(gift_id)
                .fetch_optional(pool)
                .await?
                {
                    (Some(row.0), None, Some(row.1))
                } else {
                    (None, None, None)
                }
            } else {
                (None, None, None)
            };
        let Some(event_id) = event_id else {
            continue;
        };
        if !event_ids.contains(&event_id) {
            continue;
        }
        if let Some(status) = params.get("status") {
            if !status.is_empty() && &order.status != status {
                continue;
            }
        }
        if let Some(search) = params.get("search") {
            let search = search.to_lowercase();
            if !order.code.to_lowercase().contains(&search)
                && !order.payer_email.to_lowercase().contains(&search)
                && !locator
                    .as_deref()
                    .is_some_and(|value| value.to_lowercase().contains(&search))
            {
                continue;
            }
        }
        let mut value = serde_json::to_value(&order).map_err(ApiError::internal)?;
        if let Some(object) = value.as_object_mut() {
            object.insert(
                "eventName".into(),
                json!(events.get(&event_id).map(|event| event.name.clone())),
            );
            object.insert("registrationLocator".into(), json!(locator));
            object.insert("giftCode".into(), json!(gift_code));
            object.insert(
                "kind".into(),
                json!(if order.registration_id.is_some() {
                    "registration"
                } else {
                    "gift"
                }),
            );
        }
        items.push(value);
    }
    Ok(Json(json!(items)))
}

// --- Organizers -----------------------------------------------------------

pub async fn list_organizers(user: CurrentUser) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let organizers: Vec<Organizer> =
        sqlx::query_as("SELECT * FROM organizers ORDER BY name ASC")
            .fetch_all(pool)
            .await?;
    let mut items = Vec::new();
    for organizer in organizers {
        let events: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE organizer_id = ?")
            .bind(organizer.id)
            .fetch_one(pool)
            .await?;
        let accounts: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM organizer_accounts WHERE organizer_id = ?")
                .bind(organizer.id)
                .fetch_one(pool)
                .await?;
        let mut value = serde_json::to_value(&organizer).map_err(ApiError::internal)?;
        if let Some(object) = value.as_object_mut() {
            object.insert("eventCount".into(), json!(events));
            object.insert("accountCount".into(), json!(accounts));
        }
        items.push(value);
    }
    Ok(Json(json!(items)))
}

async fn unique_organizer_slug(base: &str, exclude_id: Option<i64>) -> Result<String, ApiError> {
    let pool = larust_support::orm::pool()?;
    let base = slugify(base);
    let mut candidate = base.clone();
    let mut counter = 2;
    loop {
        let existing: Option<i64> =
            sqlx::query_scalar("SELECT id FROM organizers WHERE slug = ? AND id != ?")
                .bind(&candidate)
                .bind(exclude_id.unwrap_or(0))
                .fetch_optional(pool)
                .await?;
        if existing.is_none() {
            return Ok(candidate);
        }
        candidate = format!("{}-{}", base, counter);
        counter += 1;
    }
}

pub async fn create_organizer(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let name = body_str(&body, "name");
    if name.is_empty() {
        return Err(ApiError::bad_request("El nombre del organizador es obligatorio."));
    }
    let contact_email = body_str(&body, "contactEmail").to_lowercase();
    if !contact_email.is_empty() && !is_valid_email(&contact_email) {
        return Err(ApiError::bad_request("El correo de contacto no es válido."));
    }
    let slug = {
        let provided = body_str(&body, "slug");
        unique_organizer_slug(
            if provided.is_empty() { &name } else { &provided },
            None,
        )
        .await?
    };
    let pool = larust_support::orm::pool()?;
    let organizer_id: i64 = sqlx::query_scalar(
        "INSERT INTO organizers (name, slug, contact_email, phone, description, logo_url, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(&name)
    .bind(&slug)
    .bind(&contact_email)
    .bind(body_str(&body, "phone"))
    .bind(body_str(&body, "description"))
    .bind(body_str(&body, "logoUrl"))
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let organizer: Organizer = sqlx::query_as("SELECT * FROM organizers WHERE id = ?")
        .bind(organizer_id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(organizer)))
}

pub async fn update_organizer(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let organizer: Organizer = sqlx::query_as("SELECT * FROM organizers WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Organizer not found."))?;
    let name = body_opt_str(&body, "name").unwrap_or_else(|| organizer.name.clone());
    let slug = match body_opt_str(&body, "slug") {
        Some(slug) if !slug.trim().is_empty() => {
            unique_organizer_slug(&slug, Some(organizer.id)).await?
        }
        _ => organizer.slug.clone(),
    };
    let contact_email =
        body_opt_str(&body, "contactEmail").unwrap_or_else(|| organizer.contact_email.clone());
    sqlx::query(
        "UPDATE organizers SET name = ?, slug = ?, contact_email = ?, phone = ?, description = ?,
         logo_url = ?, active = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&slug)
    .bind(contact_email.to_lowercase())
    .bind(body_opt_str(&body, "phone").unwrap_or_else(|| organizer.phone.clone()))
    .bind(body_opt_str(&body, "description").unwrap_or_else(|| organizer.description.clone()))
    .bind(body_opt_str(&body, "logoUrl").unwrap_or_else(|| organizer.logo_url.clone()))
    .bind(body_bool(&body, "active").unwrap_or(organizer.active != 0) as i64)
    .bind(organizer.id)
    .execute(pool)
    .await?;
    let organizer: Organizer = sqlx::query_as("SELECT * FROM organizers WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(organizer)))
}

pub async fn delete_organizer(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    sqlx::query("DELETE FROM organizers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Organizador eliminado." })))
}

// --- Organizer accounts ---------------------------------------------------

async fn email_taken(email: &str, exclude_admin: Option<i64>, exclude_account: Option<i64>) -> Result<bool, ApiError> {
    let pool = larust_support::orm::pool()?;
    let admin: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?",
    )
    .bind(email)
    .bind(exclude_admin.unwrap_or(0))
    .fetch_optional(pool)
    .await?;
    if admin.is_some() {
        return Ok(true);
    }
    let account: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM organizer_accounts WHERE LOWER(email) = LOWER(?) AND id != ?",
    )
    .bind(email)
    .bind(exclude_account.unwrap_or(0))
    .fetch_optional(pool)
    .await?;
    Ok(account.is_some())
}

pub async fn list_accounts(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let accounts: Vec<OrganizerAccount> =
        sqlx::query_as("SELECT * FROM organizer_accounts WHERE organizer_id = ? ORDER BY name ASC")
            .bind(id)
            .fetch_all(pool)
            .await?;
    Ok(Json(json!(accounts)))
}

pub async fn create_account(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let organizer: Option<i64> = sqlx::query_scalar("SELECT id FROM organizers WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    if organizer.is_none() {
        return Err(ApiError::not_found("Organizer not found."));
    }
    let name = body_str(&body, "name");
    let email = body_str(&body, "email").to_lowercase();
    let password = body_str(&body, "password");
    if name.is_empty() || !is_valid_email(&email) {
        return Err(ApiError::bad_request("Introduce un nombre y un correo válidos."));
    }
    if password.len() < 8 {
        return Err(ApiError::bad_request("La contraseña debe tener al menos 8 caracteres."));
    }
    if email_taken(&email, None, None).await? {
        return Err(ApiError::conflict("Ese correo ya está en uso."));
    }
    let hash = hash_password(&password)?;
    let account_id: i64 = sqlx::query_scalar(
        "INSERT INTO organizer_accounts (organizer_id, name, email, password_hash, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(id)
    .bind(&name)
    .bind(&email)
    .bind(hash)
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let account: OrganizerAccount =
        sqlx::query_as("SELECT * FROM organizer_accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(pool)
            .await?;
    Ok(Json(json!(account)))
}

pub async fn update_account(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let account: OrganizerAccount =
        sqlx::query_as("SELECT * FROM organizer_accounts WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Account not found."))?;
    let email = body_opt_str(&body, "email")
        .map(|value| value.to_lowercase())
        .unwrap_or_else(|| account.email.clone());
    if email_taken(&email, None, Some(account.id)).await? {
        return Err(ApiError::conflict("Ese correo ya está en uso."));
    }
    let password = body_str(&body, "password");
    let hash = if password.is_empty() {
        account.password_hash.clone()
    } else {
        if password.len() < 8 {
            return Err(ApiError::bad_request("La contraseña debe tener al menos 8 caracteres."));
        }
        hash_password(&password)?
    };
    sqlx::query(
        "UPDATE organizer_accounts SET name = ?, email = ?, password_hash = ?, active = ? WHERE id = ?",
    )
    .bind(body_opt_str(&body, "name").unwrap_or_else(|| account.name.clone()))
    .bind(&email)
    .bind(hash)
    .bind(body_bool(&body, "active").unwrap_or(account.active != 0) as i64)
    .bind(account.id)
    .execute(pool)
    .await?;
    let account: OrganizerAccount =
        sqlx::query_as("SELECT * FROM organizer_accounts WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;
    Ok(Json(json!(account)))
}

pub async fn delete_account(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    sqlx::query("DELETE FROM organizer_accounts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Cuenta eliminada." })))
}

// --- Admin users ----------------------------------------------------------

pub async fn list_admins(user: CurrentUser) -> Result<Json<Value>, ApiError> {
    user.require_superadmin()?;
    let pool = larust_support::orm::pool()?;
    let admins: Vec<AdminUser> =
        sqlx::query_as("SELECT * FROM admin_users ORDER BY name ASC")
            .fetch_all(pool)
            .await?;
    Ok(Json(json!(admins)))
}

pub async fn create_admin(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_superadmin()?;
    let name = body_str(&body, "name");
    let email = body_str(&body, "email").to_lowercase();
    let password = body_str(&body, "password");
    let role = {
        let role = body_str(&body, "role");
        if role.is_empty() { "admin".to_string() } else { role }
    };
    if name.is_empty() || !is_valid_email(&email) {
        return Err(ApiError::bad_request("Introduce un nombre y un correo válidos."));
    }
    if password.len() < 8 {
        return Err(ApiError::bad_request("La contraseña debe tener al menos 8 caracteres."));
    }
    if !["admin", "superadmin"].contains(&role.as_str()) {
        return Err(ApiError::bad_request("El rol no es válido."));
    }
    if email_taken(&email, None, None).await? {
        return Err(ApiError::conflict("Ese correo ya está en uso."));
    }
    let hash = hash_password(&password)?;
    let pool = larust_support::orm::pool()?;
    let admin_id: i64 = sqlx::query_scalar(
        "INSERT INTO admin_users (name, email, password_hash, role, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(&name)
    .bind(&email)
    .bind(hash)
    .bind(&role)
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let admin: AdminUser = sqlx::query_as("SELECT * FROM admin_users WHERE id = ?")
        .bind(admin_id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(admin)))
}

pub async fn update_admin(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_superadmin()?;
    let pool = larust_support::orm::pool()?;
    let admin: AdminUser = sqlx::query_as("SELECT * FROM admin_users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Admin not found."))?;
    let email = body_opt_str(&body, "email")
        .map(|value| value.to_lowercase())
        .unwrap_or_else(|| admin.email.clone());
    if email_taken(&email, Some(admin.id), None).await? {
        return Err(ApiError::conflict("Ese correo ya está en uso."));
    }
    let role = body_opt_str(&body, "role").unwrap_or_else(|| admin.role.clone());
    if !["admin", "superadmin"].contains(&role.as_str()) {
        return Err(ApiError::bad_request("El rol no es válido."));
    }
    let active = body_bool(&body, "active").unwrap_or(admin.active != 0);
    if admin.id == user.id && !active {
        return Err(ApiError::bad_request("No puedes desactivar tu propia cuenta."));
    }
    if admin.role == "superadmin" && role != "superadmin" {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM admin_users WHERE role = 'superadmin' AND active = 1",
        )
        .fetch_one(pool)
        .await?;
        if count <= 1 {
            return Err(ApiError::conflict("Debe existir al menos un superadmin activo."));
        }
    }
    let password = body_str(&body, "password");
    let hash = if password.is_empty() {
        admin.password_hash.clone()
    } else {
        if password.len() < 8 {
            return Err(ApiError::bad_request("La contraseña debe tener al menos 8 caracteres."));
        }
        hash_password(&password)?
    };
    sqlx::query(
        "UPDATE admin_users SET name = ?, email = ?, password_hash = ?, role = ?, active = ? WHERE id = ?",
    )
    .bind(body_opt_str(&body, "name").unwrap_or_else(|| admin.name.clone()))
    .bind(&email)
    .bind(hash)
    .bind(&role)
    .bind(active as i64)
    .bind(admin.id)
    .execute(pool)
    .await?;
    let admin: AdminUser = sqlx::query_as("SELECT * FROM admin_users WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(admin)))
}

pub async fn delete_admin(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    user.require_superadmin()?;
    if user.id == id {
        return Err(ApiError::bad_request("No puedes eliminar tu propia cuenta."));
    }
    let pool = larust_support::orm::pool()?;
    let admin: AdminUser = sqlx::query_as("SELECT * FROM admin_users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Admin not found."))?;
    if admin.role == "superadmin" {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM admin_users WHERE role = 'superadmin' AND active = 1",
        )
        .fetch_one(pool)
        .await?;
        if count <= 1 {
            return Err(ApiError::conflict("Debe existir al menos un superadmin activo."));
        }
    }
    sqlx::query("DELETE FROM admin_users WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Administrador eliminado." })))
}

// --- Mail outbox ----------------------------------------------------------

pub async fn list_emails(user: CurrentUser) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let emails: Vec<EmailOutbox> =
        sqlx::query_as("SELECT * FROM email_outbox ORDER BY id DESC LIMIT 200")
            .fetch_all(pool)
            .await?;
    Ok(Json(json!(emails)))
}

// Keep the Club type referenced by the admin API surface (clubs are read
// here through `list_clubs_admin`); this avoids a dead-code warning for a
// type that is part of the public response contract.
#[allow(dead_code)]
fn _clubs_contract(_: Club) {}
