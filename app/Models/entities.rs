use larust_support::orm::sqlx;
use serde::{Deserialize, Serialize};

/// Backoffice administrator. `role` is either `superadmin` or `admin`.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminUser {
    pub id: i64,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Organizer {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub contact_email: String,
    pub phone: String,
    pub description: String,
    pub logo_url: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct OrganizerAccount {
    pub id: i64,
    pub organizer_id: i64,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Club {
    pub id: i64,
    pub name: String,
    pub province: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: i64,
    pub organizer_id: Option<i64>,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub venue: String,
    pub address: String,
    pub city: String,
    pub province: String,
    pub country: String,
    pub cover_image_url: String,
    pub start_date: String,
    pub end_date: String,
    pub registration_deadline: String,
    pub status: String,
    pub max_participants: Option<i64>,
    pub published: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Modality {
    pub id: i64,
    pub event_id: i64,
    pub name: String,
    pub description: String,
    pub distance_km: Option<f64>,
    pub start_time: String,
    pub max_participants: Option<i64>,
    pub base_price: f64,
    pub dynamic_fields: String,
    pub active: i64,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PriceTier {
    pub id: i64,
    pub modality_id: i64,
    pub name: String,
    pub price: f64,
    pub starts_at: String,
    pub ends_at: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Coupon {
    pub id: i64,
    pub event_id: Option<i64>,
    pub modality_id: Option<i64>,
    pub code: String,
    pub kind: String,
    pub value: f64,
    pub max_uses: Option<i64>,
    pub uses: i64,
    pub valid_from: String,
    pub valid_until: String,
    pub active: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Gift {
    pub id: i64,
    pub event_id: i64,
    pub modality_id: i64,
    pub buyer_name: String,
    pub buyer_email: String,
    pub recipient_name: String,
    pub recipient_email: String,
    pub message: String,
    pub code: String,
    pub price_paid: f64,
    pub status: String,
    pub claimed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Registration {
    pub id: i64,
    pub event_id: i64,
    pub modality_id: i64,
    pub locator: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub birth_date: String,
    pub gender: String,
    pub document_id: String,
    pub province: String,
    pub country: String,
    pub club_id: Option<i64>,
    pub club_name: String,
    pub dynamic_data: String,
    pub base_price: f64,
    pub discount: f64,
    pub total: f64,
    pub coupon_id: Option<i64>,
    pub gift_id: Option<i64>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id: i64,
    pub code: String,
    pub registration_id: Option<i64>,
    pub gift_id: Option<i64>,
    pub amount: f64,
    pub status: String,
    pub payment_method: String,
    pub reference: String,
    pub payer_name: String,
    pub payer_email: String,
    pub paid_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EmailOutbox {
    pub id: i64,
    pub to_email: String,
    pub subject: String,
    pub body: String,
    pub status: String,
    pub created_at: String,
}
