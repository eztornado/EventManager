use larust_support::axum::Json;
use larust_support::orm::sqlx;
use larust_support::serde_json::{json, Value};

use crate::models::{AdminUser, OrganizerAccount};
use crate::services::auth::{hash_password, issue_token, verify_password, CurrentUser};
use crate::services::util::{is_valid_email, now_iso};
use crate::services::ApiError;

fn body_string(body: &Value, key: &str) -> String {
    body.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub async fn login(Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    let email = body_string(&body, "email").to_lowercase();
    let password = body_string(&body, "password");
    if email.is_empty() || password.is_empty() {
        return Err(ApiError::bad_request("Introduce tu correo y contraseña."));
    }
    let pool = larust_support::orm::pool()?;

    let admin: Option<AdminUser> =
        sqlx::query_as("SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)")
            .bind(&email)
            .fetch_optional(pool)
            .await?;
    if let Some(admin) = admin {
        if admin.active == 0 {
            return Err(ApiError::forbidden("Esta cuenta está desactivada."));
        }
        if !verify_password(&admin.password_hash, &password)? {
            return Err(ApiError::unauthorized("El correo o la contraseña no son correctos."));
        }
        let token = issue_token(admin.id, &admin.role, None)?;
        return Ok(Json(json!({
            "token": token,
            "user": {
                "id": admin.id,
                "name": admin.name,
                "email": admin.email,
                "role": admin.role,
                "organizerId": Value::Null
            }
        })));
    }

    let account: Option<OrganizerAccount> = sqlx::query_as(
        "SELECT * FROM organizer_accounts WHERE LOWER(email) = LOWER(?)",
    )
    .bind(&email)
    .fetch_optional(pool)
    .await?;
    let account = account.ok_or_else(|| {
        ApiError::unauthorized("El correo o la contraseña no son correctos.")
    })?;
    if account.active == 0 {
        return Err(ApiError::forbidden("Esta cuenta está desactivada."));
    }
    if !verify_password(&account.password_hash, &password)? {
        return Err(ApiError::unauthorized("El correo o la contraseña no son correctos."));
    }
    let organizer_name: Option<String> =
        sqlx::query_scalar("SELECT name FROM organizers WHERE id = ?")
            .bind(account.organizer_id)
            .fetch_optional(pool)
            .await?;
    let token = issue_token(account.id, "organizer", Some(account.organizer_id))?;
    Ok(Json(json!({
        "token": token,
        "user": {
            "id": account.id,
            "name": account.name,
            "email": account.email,
            "role": "organizer",
            "organizerId": account.organizer_id,
            "organizerName": organizer_name
        }
    })))
}

pub async fn me(user: CurrentUser) -> Result<Json<Value>, ApiError> {
    let organizer_name = if let Some(organizer_id) = user.organizer_id {
        let pool = larust_support::orm::pool()?;
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM organizers WHERE id = ?")
            .bind(organizer_id)
            .fetch_optional(pool)
            .await?;
        name
    } else {
        None
    };
    Ok(Json(json!({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "organizerId": user.organizer_id,
        "organizerName": organizer_name
    })))
}

pub async fn change_password(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let current = body_string(&body, "currentPassword");
    let new_password = body_string(&body, "newPassword");
    if new_password.len() < 8 {
        return Err(ApiError::bad_request("La nueva contraseña debe tener al menos 8 caracteres."));
    }
    let pool = larust_support::orm::pool()?;
    if user.is_organizer() {
        let account: OrganizerAccount =
            sqlx::query_as("SELECT * FROM organizer_accounts WHERE id = ?")
                .bind(user.id)
                .fetch_one(pool)
                .await?;
        if !verify_password(&account.password_hash, &current)? {
            return Err(ApiError::bad_request("La contraseña actual no es correcta."));
        }
        let hash = hash_password(&new_password)?;
        sqlx::query("UPDATE organizer_accounts SET password_hash = ? WHERE id = ?")
            .bind(hash)
            .bind(user.id)
            .execute(pool)
            .await?;
    } else {
        let admin: AdminUser = sqlx::query_as("SELECT * FROM admin_users WHERE id = ?")
            .bind(user.id)
            .fetch_one(pool)
            .await?;
        if !verify_password(&admin.password_hash, &current)? {
            return Err(ApiError::bad_request("La contraseña actual no es correcta."));
        }
        let hash = hash_password(&new_password)?;
        sqlx::query("UPDATE admin_users SET password_hash = ? WHERE id = ?")
            .bind(hash)
            .bind(user.id)
            .execute(pool)
            .await?;
    }
    let _ = now_iso();
    Ok(Json(json!({ "message": "Contraseña actualizada correctamente." })))
}

pub async fn update_profile(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let name = body_string(&body, "name");
    let email = body_string(&body, "email").to_lowercase();
    if name.is_empty() || !is_valid_email(&email) {
        return Err(ApiError::bad_request("Introduce un nombre y un correo válidos."));
    }
    let pool = larust_support::orm::pool()?;
    if user.is_organizer() {
        let duplicate: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM organizer_accounts WHERE LOWER(email) = LOWER(?) AND id != ?",
        )
        .bind(&email)
        .bind(user.id)
        .fetch_optional(pool)
        .await?;
        if duplicate.is_some() {
            return Err(ApiError::conflict("Ese correo ya está en uso."));
        }
        sqlx::query("UPDATE organizer_accounts SET name = ?, email = ? WHERE id = ?")
            .bind(&name)
            .bind(&email)
            .bind(user.id)
            .execute(pool)
            .await?;
    } else {
        let duplicate: Option<i64> =
            sqlx::query_scalar("SELECT id FROM admin_users WHERE LOWER(email) = LOWER(?) AND id != ?")
                .bind(&email)
                .bind(user.id)
                .fetch_optional(pool)
                .await?;
        if duplicate.is_some() {
            return Err(ApiError::conflict("Ese correo ya está en uso."));
        }
        sqlx::query("UPDATE admin_users SET name = ?, email = ? WHERE id = ?")
            .bind(&name)
            .bind(&email)
            .bind(user.id)
            .execute(pool)
            .await?;
    }
    Ok(Json(json!({ "message": "Perfil actualizado correctamente." })))
}
