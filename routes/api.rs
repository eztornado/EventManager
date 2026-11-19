use larust_http::{Route, Router};
use larust_support::axum::Json;
use larust_support::serde_json::json;

use crate::controllers::{admin_auth, admin_catalog, admin_dashboard, admin_people, public};

async fn health() -> Json<larust_support::serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "EventManager API",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

pub fn routes() -> Router {
    Route::get("/health", health)
        // --- Public storefront ------------------------------------------
        .get("/events", public::list_events)
        .get("/events/{slug}", public::get_event)
        .get("/events/{slug}/participants", public::event_participants)
        .get("/clubs", public::list_clubs)
        .get("/payment/config", public::payment_config)
        .post("/coupons/validate", public::validate_coupon)
        .post("/registrations", public::create_registration)
        .post("/registrations/recover", public::recover_registration)
        .get("/registrations/{locator}", public::get_registration)
        .put("/registrations/{locator}", public::update_registration)
        .post("/registrations/{locator}/cancel", public::cancel_registration)
        .get("/registrations/{locator}/receipt", public::registration_receipt)
        .post("/gifts", public::create_gift)
        .get("/gifts/{code}", public::get_gift)
        .post("/gifts/{code}/claim", public::claim_gift)
        .post("/orders/{code}/pay", public::pay_order)
        .post("/orders/{code}/confirm", public::confirm_order)
        .post("/stripe/webhook", public::stripe_webhook)
        // --- Backoffice authentication ----------------------------------
        .post("/admin/auth/login", admin_auth::login)
        .get("/admin/auth/me", admin_auth::me)
        .put("/admin/auth/profile", admin_auth::update_profile)
        .put("/admin/auth/password", admin_auth::change_password)
        // --- Dashboard ---------------------------------------------------
        .get("/admin/dashboard", admin_dashboard::dashboard)
        // --- Events ------------------------------------------------------
        .get("/admin/events", admin_catalog::list_events)
        .post("/admin/events", admin_catalog::create_event)
        .get("/admin/events/{id}", admin_catalog::get_event_detail)
        .put("/admin/events/{id}", admin_catalog::update_event)
        .delete("/admin/events/{id}", admin_catalog::delete_event)
        .get("/admin/events/{id}/modalities", admin_catalog::list_modalities)
        .post("/admin/events/{id}/modalities", admin_catalog::create_modality)
        // --- Modalities and price tiers ---------------------------------
        .put("/admin/modalities/{id}", admin_catalog::update_modality)
        .delete("/admin/modalities/{id}", admin_catalog::delete_modality)
        .get("/admin/modalities/{id}/tiers", admin_catalog::list_tiers)
        .post("/admin/modalities/{id}/tiers", admin_catalog::create_tier)
        .put("/admin/tiers/{id}", admin_catalog::update_tier)
        .delete("/admin/tiers/{id}", admin_catalog::delete_tier)
        // --- Coupons -----------------------------------------------------
        .get("/admin/coupons", admin_catalog::list_coupons)
        .post("/admin/coupons", admin_catalog::create_coupon)
        .put("/admin/coupons/{id}", admin_catalog::update_coupon)
        .delete("/admin/coupons/{id}", admin_catalog::delete_coupon)
        // --- Clubs -------------------------------------------------------
        .get("/admin/clubs", admin_catalog::list_clubs_admin)
        .post("/admin/clubs", admin_catalog::create_club)
        .put("/admin/clubs/{id}", admin_catalog::update_club)
        .delete("/admin/clubs/{id}", admin_catalog::delete_club)
        // --- Registrations ----------------------------------------------
        .get("/admin/registrations", admin_people::list_registrations)
        .get("/admin/registrations/export.csv", admin_people::export_registrations)
        .get("/admin/registrations/{id}", admin_people::get_registration)
        .put("/admin/registrations/{id}", admin_people::update_registration)
        .delete("/admin/registrations/{id}", admin_people::delete_registration)
        // --- Gifts -------------------------------------------------------
        .get("/admin/gifts", admin_people::list_gifts)
        .post("/admin/gifts/{id}/resend", admin_people::resend_gift)
        .delete("/admin/gifts/{id}", admin_people::delete_gift)
        // --- Orders ------------------------------------------------------
        .get("/admin/orders", admin_people::list_orders)
        // --- Organizers and accounts ------------------------------------
        .get("/admin/organizers", admin_people::list_organizers)
        .post("/admin/organizers", admin_people::create_organizer)
        .put("/admin/organizers/{id}", admin_people::update_organizer)
        .delete("/admin/organizers/{id}", admin_people::delete_organizer)
        .get("/admin/organizers/{id}/accounts", admin_people::list_accounts)
        .post("/admin/organizers/{id}/accounts", admin_people::create_account)
        .put("/admin/accounts/{id}", admin_people::update_account)
        .delete("/admin/accounts/{id}", admin_people::delete_account)
        // --- Admin users -------------------------------------------------
        .get("/admin/users", admin_people::list_admins)
        .post("/admin/users", admin_people::create_admin)
        .put("/admin/users/{id}", admin_people::update_admin)
        .delete("/admin/users/{id}", admin_people::delete_admin)
        // --- Mail outbox -------------------------------------------------
        .get("/admin/emails", admin_people::list_emails)
        .middleware(larust_http::throttle::per_minute(300))
        .middleware(larust_http::axum::middleware::from_fn(
            larust_http::locale::negotiate_from_header,
        ))
}
