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
