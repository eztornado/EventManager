use larust_http::Router;

#[tokio::main]
async fn main() -> Result<(), larust_core::AppError> {
    let command = std::env::args().nth(1);

    if command.as_deref() == Some("migrate") {
        eventmanager::connect_database().await?;
        larust_support::orm::migrate(&eventmanager::paths().migrations()).await?;
        return Ok(());
    }

    if command.as_deref() == Some("migrate:fresh") {
        eventmanager::connect_database().await?;
        larust_support::orm::migrate_fresh(&eventmanager::paths().migrations()).await?;
        if std::env::args().any(|arg| arg == "--seed") {
            eventmanager::seeders::run().await?;
        }
        return Ok(());
    }

    if command.as_deref() == Some("db:seed") {
        eventmanager::connect_database().await?;
        eventmanager::seeders::run().await?;
        return Ok(());
    }

    if command.as_deref() == Some("admin:create") {
        create_admin().await?;
        return Ok(());
    }

    if command.as_deref() == Some("route:list") {
        let app = eventmanager::application()?;
        let route = eventmanager::router(&app);
        print_routes(&route);
        return Ok(());
    }

    if let Some(name) = command.as_deref() {
        eprintln!("error: unknown command {name:?}");
        std::process::exit(1);
    }

    eventmanager::serve().await
}

/// Creates the first superadmin from `ADMIN_NAME`, `ADMIN_EMAIL` and
/// `ADMIN_PASSWORD`. Used by the container entrypoint so a fresh production
/// deployment has a way in without loading the demo dataset.
async fn create_admin() -> Result<(), larust_core::AppError> {
    use eventmanager::services::ApiError;

    async fn create() -> Result<(), ApiError> {
        eventmanager::connect_database().await.map_err(ApiError::from)?;

        let name = std::env::var("ADMIN_NAME")
            .unwrap_or_else(|_| "Administrador".to_string())
            .trim()
            .to_string();
        let email = std::env::var("ADMIN_EMAIL")
            .unwrap_or_default()
            .trim()
            .to_lowercase();
        let password = std::env::var("ADMIN_PASSWORD").unwrap_or_default();

        if name.is_empty() || email.is_empty() || password.is_empty() {
            return Err(ApiError::bad_request(
                "ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios.",
            ));
        }
        if !email.contains('@') {
            return Err(ApiError::bad_request("ADMIN_EMAIL no es un correo válido."));
        }
        if password.len() < 8 {
            return Err(ApiError::bad_request(
                "ADMIN_PASSWORD debe tener al menos 8 caracteres.",
            ));
        }

        let pool = larust_support::orm::pool()?;
        let existing: i64 =
            larust_support::orm::sqlx::query_scalar("SELECT COUNT(*) FROM admin_users WHERE email = ?")
                .bind(&email)
                .fetch_one(pool)
                .await?;
        if existing > 0 {
            println!("Admin {email} already exists; skipping.");
            return Ok(());
        }

        let password_hash = eventmanager::services::auth::hash_password(&password)?;
        larust_support::orm::sqlx::query(
            "INSERT INTO admin_users (name, email, password_hash, role, active)
             VALUES (?, ?, ?, 'superadmin', 1)",
        )
        .bind(&name)
        .bind(&email)
        .bind(password_hash)
        .execute(pool)
        .await?;
        println!("Superadmin {email} created.");
        Ok(())
    }

    create().await.map_err(larust_core::AppError::from)
}

fn print_routes(route: &Router) {
    for info in route.routes() {
        println!(
            "{:<7} {:<40} {}",
            info.method,
            info.path,
            info.name.as_deref().unwrap_or("")
        );
    }
}
