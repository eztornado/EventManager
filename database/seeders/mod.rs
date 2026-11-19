use chrono::{Duration, Utc};
use larust_support::orm::sqlx;
use larust_support::serde_json::json;

use crate::services::auth::hash_password;
use crate::services::util::{now_iso, random_code};

struct EventSeed {
    organizer: i64,
    name: &'static str,
    slug: &'static str,
    description: &'static str,
    venue: &'static str,
    address: &'static str,
    city: &'static str,
    province: &'static str,
    start: &'static str,
    end: &'static str,
    deadline: &'static str,
    status: &'static str,
    max: Option<i64>,
    published: bool,
}

struct ModalitySeed {
    event: usize,
    name: &'static str,
    description: &'static str,
    distance: Option<f64>,
    start_time: &'static str,
    max: Option<i64>,
    price: f64,
    fields: serde_json::Value,
}

pub async fn run() -> Result<(), crate::services::ApiError> {
    let pool = larust_support::orm::pool()?;
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM admin_users")
        .fetch_one(pool)
        .await?;
    if existing > 0 {
        println!("Database already contains data; skipping demo seed.");
        return Ok(());
    }

    // --- Accounts ---------------------------------------------------------
    let super_hash = hash_password("admin1234")?;
    let admin_hash = hash_password("admin1234")?;
    let organizer_hash = hash_password("organizer123")?;

    sqlx::query(
        "INSERT INTO admin_users (name, email, password_hash, role, active) VALUES
         ('Elena Rivas', 'elena@eventmanager.test', ?, 'superadmin', 1),
         ('Marta Soler', 'marta@eventmanager.test', ?, 'admin', 1)",
    )
    .bind(&super_hash)
    .bind(&admin_hash)
    .execute(pool)
    .await?;

    let organizers = [
        (
            "Deportes Horizonte",
            "deportes-horizonte",
            "hola@horizonte.test",
            "619 000 101",
            "Organizador de pruebas de montaña, asfalto y deporte popular.",
        ),
        (
            "Fundación Sendero Vivo",
            "fundacion-sendero-vivo",
            "info@senderovivo.test",
            "619 000 202",
            "Entidad sin ánimo de lucro dedicada al deporte inclusivo y solidario.",
        ),
        (
            "Club Aventura Mediterránea",
            "club-aventura-mediterranea",
            "contacto@aventuramed.test",
            "619 000 303",
            "Pruebas multideporte en la costa mediterránea.",
        ),
    ];
    for (name, slug, email, phone, description) in organizers {
        sqlx::query(
            "INSERT INTO organizers (name, slug, contact_email, phone, description, active)
             VALUES (?, ?, ?, ?, ?, 1)",
        )
        .bind(name)
        .bind(slug)
        .bind(email)
        .bind(phone)
        .bind(description)
        .execute(pool)
        .await?;
    }

    let accounts = [
        (1_i64, "Javier Molina", "javier@horizonte.test"),
        (2, "Lucía Ferrer", "lucia@senderovivo.test"),
        (3, "Diego Navarro", "diego@aventuramed.test"),
    ];
    for (organizer_id, name, email) in accounts {
        sqlx::query(
            "INSERT INTO organizer_accounts (organizer_id, name, email, password_hash, active)
             VALUES (?, ?, ?, ?, 1)",
        )
        .bind(organizer_id)
        .bind(name)
        .bind(email)
        .bind(&organizer_hash)
        .execute(pool)
        .await?;
    }

    // --- Clubs ------------------------------------------------------------
    let clubs = [
        ("Club Atletismo Norte", "Segovia"),
        ("Peña Ciclista del Valle", "Cantabria"),
        ("Club Montaña Alpina", "Huesca"),
        ("Runners del Puerto", "Valencia"),
        ("Club Deportivo Horizonte", "Madrid"),
        ("Trail Sierra Verde", "Segovia"),
        ("Club Náutico Costa", "Cádiz"),
        ("Atletismo Vega", "Toledo"),
        ("Club Ultra Sur", "Málaga"),
        ("Escuela del Mar", "Alicante"),
        ("Club Ciclista Central", "Madrid"),
        ("Deportes Alameda", "Sevilla"),
    ];
    for (name, province) in clubs {
        sqlx::query("INSERT INTO clubs (name, province, active) VALUES (?, ?, 1)")
            .bind(name)
            .bind(province)
            .execute(pool)
            .await?;
    }

    // --- Events -----------------------------------------------------------
    let events = [
        EventSeed {
            organizer: 1,
            name: "Travesía Sierra Norte",
            slug: "travesia-sierra-norte",
            description: "Una jornada de trail por los bosques y crestas de la Sierra Norte, con recorridos para todos los niveles. Avituallamientos cada 7 km, zona de ludoteca y comida popular al terminar.",
            venue: "Plaza Mayor",
            address: "Plaza Mayor, 1",
            city: "Segovia",
            province: "Segovia",
            start: "2027-05-15T08:00:00Z",
            end: "2027-05-15T18:00:00Z",
            deadline: "2027-05-09T23:59:59Z",
            status: "Inscripciones abiertas",
            max: Some(750),
            published: true,
        },
        EventSeed {
            organizer: 1,
            name: "Maratón Costa Azul",
            slug: "maraton-costa-azul",
            description: "Un maratón rápido y llano junto al mar, con salida al amanecer y animación en cada kilómetro. Incluye medalla, camiseta técnica y acceso a la zona de recuperación.",
            venue: "Paseo Marítimo",
            address: "Paseo Marítimo, s/n",
            city: "Valencia",
            province: "Valencia",
            start: "2027-04-11T07:00:00Z",
            end: "2027-04-11T14:00:00Z",
            deadline: "2027-04-04T23:59:59Z",
            status: "Inscripciones abiertas",
            max: Some(3500),
            published: true,
        },
        EventSeed {
            organizer: 2,
            name: "Ultra Valle del Silencio",
            slug: "ultra-valle-del-silencio",
            description: "Travesía de alta montaña con desnivel acumulado y pasos técnicos. Plazas limitadas y material obligatorio. La organización publicará el track definitivo una semana antes.",
            venue: "Campo de Fútbol Municipal",
            address: "Calle del Río, 4",
            city: "Potes",
            province: "Cantabria",
            start: "2027-07-03T06:00:00Z",
            end: "2027-07-04T12:00:00Z",
            deadline: "2027-06-25T23:59:59Z",
            status: "Inscripciones abiertas",
            max: Some(400),
            published: true,
        },
        EventSeed {
            organizer: 3,
            name: "Triatlón Bahía de Cádiz",
            slug: "triatlon-bahia-de-cadiz",
            description: "Triatlón con sectores de natación en aguas abiertas, ciclismo por la bahía y carrera a pie por el casco histórico. Dos distancias y categoría por relevos.",
            venue: "Playa de la Victoria",
            address: "Paseo Marítimo, 20",
            city: "Cádiz",
            province: "Cádiz",
            start: "2027-09-18T08:00:00Z",
            end: "2027-09-18T15:00:00Z",
            deadline: "2027-09-10T23:59:59Z",
            status: "Programada",
            max: Some(900),
            published: true,
        },
        EventSeed {
            organizer: 2,
            name: "Marcha Solidaria Río Claro",
            slug: "marcha-solidaria-rio-claro",
            description: "Marcha familiar y no competitiva a favor de proyectos de agua potable. Recorridos de 5 y 10 km, accesibles para carritos y sillas de ruedas. Dorsal solidario y avituallamiento final.",
            venue: "Parque Fluvial",
            address: "Camino del Río, s/n",
            city: "Cuenca",
            province: "Cuenca",
            start: "2027-03-07T10:00:00Z",
            end: "2027-03-07T14:00:00Z",
            deadline: "2027-03-01T23:59:59Z",
            status: "Inscripciones abiertas",
            max: Some(1500),
            published: true,
        },
        EventSeed {
            organizer: 1,
            name: "Gravel Alto Pirineo",
            slug: "gravel-alto-pirineo",
            description: "Ruta gravel por pistas y caminos de montaña con dos distancias y avituallamientos en pueblos del valle. Evento en pausa mientras se confirma la autorización de los pasos de montaña.",
            venue: "Explanada de la Estación",
            address: "Avenida de la Estación, 2",
            city: "Jaca",
            province: "Huesca",
            start: "2027-06-19T07:30:00Z",
            end: "2027-06-19T17:00:00Z",
            deadline: "2027-06-12T23:59:59Z",
            status: "Pausa",
            max: Some(600),
            published: true,
        },
        EventSeed {
            organizer: 3,
            name: "Carrera Nocturna Casco Antiguo",
            slug: "carrera-nocturna-casco-antiguo",
            description: "Carrera urbana de 5 km por las calles iluminadas del casco antiguo. Inscripciones cerradas por aforo completo.",
            venue: "Plaza del Ayuntamiento",
            address: "Plaza del Ayuntamiento, 1",
            city: "Toledo",
            province: "Toledo",
            start: "2027-02-20T20:00:00Z",
            end: "2027-02-20T22:00:00Z",
            deadline: "2027-02-14T23:59:59Z",
            status: "Inscripciones cerradas",
            max: Some(800),
            published: true,
        },
        EventSeed {
            organizer: 1,
            name: "Duatlón Parque Central",
            slug: "duatlon-parque-central",
            description: "Duatlón de carretera con transición en el parque central. Las modalidades y precios se publicarán próximamente.",
            venue: "Parque Central",
            address: "Avenida del Parque, 10",
            city: "Madrid",
            province: "Madrid",
            start: "2027-10-10T09:00:00Z",
            end: "2027-10-10T13:00:00Z",
            deadline: "2027-10-03T23:59:59Z",
            status: "Programada",
            max: Some(500),
            published: true,
        },
    ];
    for event in &events {
        sqlx::query(
            "INSERT INTO events (organizer_id, name, slug, description, venue, address, city,
             province, country, cover_image_url, start_date, end_date, registration_deadline,
             status, max_participants, published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'España', '', ?, ?, ?, ?, ?, ?)",
        )
        .bind(event.organizer)
        .bind(event.name)
        .bind(event.slug)
        .bind(event.description)
        .bind(event.venue)
        .bind(event.address)
        .bind(event.city)
        .bind(event.province)
        .bind(event.start)
        .bind(event.end)
        .bind(event.deadline)
        .bind(event.status)
        .bind(event.max)
        .bind(event.published as i64)
        .execute(pool)
        .await?;
    }

    let trail_fields = json!([
        { "key": "shirtSize", "label": "Talla de camiseta", "type": "select", "required": true, "options": ["XS", "S", "M", "L", "XL", "XXL"] },
        { "key": "clubLicense", "label": "Número de licencia federativa", "type": "text", "required": false, "placeholder": "Opcional" },
        { "key": "experience", "label": "Años de experiencia en montaña", "type": "number", "required": false },
        { "key": "emergencyContact", "label": "Contacto de emergencia", "type": "text", "required": true },
        { "key": "medicalNotes", "label": "Alergias o notas médicas", "type": "textarea", "required": false }
    ]);
    let road_fields = json!([
        { "key": "shirtSize", "label": "Talla de camiseta", "type": "select", "required": true, "options": ["XS", "S", "M", "L", "XL", "XXL"] },
        { "key": "estimatedTime", "label": "Tiempo previsto", "type": "text", "required": false, "placeholder": "Ej. 3h 45m" },
        { "key": "emergencyContact", "label": "Contacto de emergencia", "type": "text", "required": true },
        { "key": "federation", "label": "¿Tienes licencia federativa?", "type": "checkbox", "required": false }
    ]);
    let march_fields = json!([
        { "key": "shirtSize", "label": "Talla de camiseta", "type": "select", "required": true, "options": ["XS", "S", "M", "L", "XL", "XXL"] },
        { "key": "withPet", "label": "¿Participas con mascota?", "type": "checkbox", "required": false },
        { "key": "accessibility", "label": "Necesidades de accesibilidad", "type": "textarea", "required": false }
    ]);

    let modalities = [
        ModalitySeed { event: 0, name: "Trail 42K", description: "Recorrido largo con 2.100 m de desnivel positivo.", distance: Some(42.0), start_time: "08:00", max: Some(300), price: 55.0, fields: trail_fields.clone() },
        ModalitySeed { event: 0, name: "Trail 21K", description: "Media distancia por pistas y sendas del valle.", distance: Some(21.0), start_time: "09:00", max: Some(350), price: 35.0, fields: trail_fields.clone() },
        ModalitySeed { event: 0, name: "Marcha 10K", description: "Recorrido no competitivo para caminar.", distance: Some(10.0), start_time: "10:00", max: None, price: 18.0, fields: march_fields.clone() },
        ModalitySeed { event: 1, name: "Maratón", description: "42,195 km por el paseo marítimo.", distance: Some(42.195), start_time: "07:00", max: Some(2500), price: 60.0, fields: road_fields.clone() },
        ModalitySeed { event: 1, name: "Media maratón", description: "21,097 km con salida escalonada.", distance: Some(21.097), start_time: "08:00", max: Some(800), price: 35.0, fields: road_fields.clone() },
        ModalitySeed { event: 1, name: "10K", description: "Distancia popular para corredores de todos los niveles.", distance: Some(10.0), start_time: "09:00", max: None, price: 20.0, fields: road_fields.clone() },
        ModalitySeed { event: 2, name: "Ultra 80K", description: "Recorrido de alta montaña con material obligatorio.", distance: Some(80.0), start_time: "06:00", max: Some(200), price: 90.0, fields: trail_fields.clone() },
        ModalitySeed { event: 2, name: "Trail 30K", description: "Distancia exigente pero accesible para trail runners.", distance: Some(30.0), start_time: "08:00", max: Some(200), price: 45.0, fields: trail_fields.clone() },
        ModalitySeed { event: 3, name: "Triatlón Olímpico", description: "1,5 km natación · 40 km bici · 10 km carrera.", distance: Some(51.5), start_time: "08:00", max: Some(500), price: 70.0, fields: road_fields.clone() },
        ModalitySeed { event: 3, name: "Triatlón Sprint", description: "750 m natación · 20 km bici · 5 km carrera.", distance: Some(25.75), start_time: "10:00", max: Some(400), price: 45.0, fields: road_fields.clone() },
        ModalitySeed { event: 4, name: "Marcha 5K", description: "Recorrido familiar accesible.", distance: Some(5.0), start_time: "10:00", max: None, price: 10.0, fields: march_fields.clone() },
        ModalitySeed { event: 4, name: "Marcha 10K", description: "Recorrido largo por el parque fluvial.", distance: Some(10.0), start_time: "10:00", max: None, price: 14.0, fields: march_fields.clone() },
        ModalitySeed { event: 5, name: "Gravel 90K", description: "Ruta larga por pistas del pirineo.", distance: Some(90.0), start_time: "07:30", max: Some(300), price: 50.0, fields: road_fields.clone() },
        ModalitySeed { event: 5, name: "Gravel 50K", description: "Ruta corta con menos desnivel.", distance: Some(50.0), start_time: "08:30", max: Some(300), price: 30.0, fields: road_fields.clone() },
        ModalitySeed { event: 6, name: "5K Nocturna", description: "Carrera urbana de 5 km.", distance: Some(5.0), start_time: "20:00", max: Some(800), price: 15.0, fields: road_fields.clone() },
    ];
    for modality in &modalities {
        let event_id = (modality.event + 1) as i64;
        sqlx::query(
            "INSERT INTO modalities (event_id, name, description, distance_km, start_time,
             max_participants, base_price, dynamic_fields, active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        )
        .bind(event_id)
        .bind(modality.name)
        .bind(modality.description)
        .bind(modality.distance)
        .bind(modality.start_time)
        .bind(modality.max)
        .bind(modality.price)
        .bind(modality.fields.to_string())
        .bind(modality.event as i64)
        .execute(pool)
        .await?;
    }

    // Early-bird and general price tiers for every modality.
    let modalities_db: Vec<(i64, f64, String)> =
        sqlx::query_as("SELECT id, base_price, start_time FROM modalities")
            .fetch_all(pool)
            .await?;
    for (modality_id, price, _) in &modalities_db {
        sqlx::query(
            "INSERT INTO price_tiers (modality_id, name, price, starts_at, ends_at, active)
             VALUES (?, 'Inscripción anticipada', ?, '2026-10-01T00:00:00Z', '2026-12-31T23:59:59Z', 1)",
        )
        .bind(modality_id)
        .bind(price - 10.0)
        .execute(pool)
        .await?;
        sqlx::query(
            "INSERT INTO price_tiers (modality_id, name, price, starts_at, ends_at, active)
             VALUES (?, 'Inscripción general', ?, '2027-01-01T00:00:00Z', '2027-12-31T23:59:59Z', 1)",
        )
        .bind(modality_id)
        .bind(price)
        .execute(pool)
        .await?;
    }

    // --- Coupons ----------------------------------------------------------
    let coupons = [
        (Some(1_i64), None, "BIENVENIDA10", "percent", 10.0, Some(100_i64), 12_i64, true),
        (Some(1), Some(1), "TRAIL5", "fixed", 5.0, Some(50), 8, true),
        (Some(3), None, "VERANO20", "percent", 20.0, Some(50), 3, true),
        (Some(5), None, "SOLIDARIA", "percent", 50.0, Some(200), 21, true),
        (Some(2), Some(4), "GRATIS30", "gift", 100.0, Some(30), 2, true),
        (Some(4), None, "ANTIGUO15", "percent", 15.0, Some(20), 20, false),
    ];
    for (event_id, modality_id, code, kind, value, max_uses, uses, active) in coupons {
        sqlx::query(
            "INSERT INTO coupons (event_id, modality_id, code, kind, value, max_uses, uses,
             valid_from, valid_until, active) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?)",
        )
        .bind(event_id)
        .bind(modality_id)
        .bind(code)
        .bind(kind)
        .bind(value)
        .bind(max_uses)
        .bind(uses)
        .bind(active as i64)
        .execute(pool)
        .await?;
    }

    // --- Gifts ------------------------------------------------------------
    let now = Utc::now();
    let gifts = [
        (1_i64, 1_i64, "Sergio Lamas", "sergio@example.test", "Ana Vidal", "ana.vidal@example.test", "¡Disfruta de la sierra!", "REGALO2027", 45.0, "available", None::<String>),
        (2, 4, "Nuria Peña", "nuria@example.test", "Carlos Rueda", "carlos.rueda@example.test", "Por tu cumpleaños. ¡A por el maratón!", "REGALOYA01", 50.0, "claimed", Some("2026-11-10T12:00:00Z".to_string())),
        (3, 7, "Irene Costa", "irene@example.test", "Pablo Sáez", "pablo.saez@example.test", "Nos vemos en el valle.", "REGALOPEND", 80.0, "pending", None),
        (5, 11, "Mario Gil", "mario@example.test", "Rosa Beltrán", "rosa.beltran@example.test", "Una mañana de marcha en familia.", "REGALOSOLI", 0.0, "available", None),
    ];
    for gift in &gifts {
        sqlx::query(
            "INSERT INTO gifts (event_id, modality_id, buyer_name, buyer_email, recipient_name,
             recipient_email, message, code, price_paid, status, claimed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(gift.0)
        .bind(gift.1)
        .bind(gift.2)
        .bind(gift.3)
        .bind(gift.4)
        .bind(gift.5)
        .bind(gift.6)
        .bind(gift.7)
        .bind(gift.8)
        .bind(gift.9)
        .bind(gift.10.clone())
        .execute(pool)
        .await?;
    }
    // Orders for gifts (claimed and available are paid, pending is pending).
    for (index, gift) in gifts.iter().enumerate() {
        let status = if gift.9 == "pending" { "pending" } else { "completed" };
        sqlx::query(
            "INSERT INTO orders (code, gift_id, amount, status, payment_method, reference,
             payer_name, payer_email, paid_at, created_at)
             VALUES (?, ?, ?, ?, 'card', ?, ?, ?, ?, ?)",
        )
        .bind(random_code(12))
        .bind((index + 1) as i64)
        .bind(gift.8)
        .bind(status)
        .bind(if status == "completed" { random_code(10) } else { String::new() })
        .bind(gift.2)
        .bind(gift.3)
        .bind(if status == "completed" { Some(now_iso()) } else { None })
        .bind((now - Duration::days((index as i64 + 1) * 3)).to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .execute(pool)
        .await?;
    }

    // --- Registrations ----------------------------------------------------
    let first_names = [
        "Lucía", "Marcos", "Elena", "Jorge", "Paula", "Iván", "Sara", "Hugo", "Nerea", "Álvaro",
        "Clara", "Diego", "Marta", "Sergio", "Aitana", "Pablo", "Irene", "Adrián", "Noa", "Raúl",
        "Vega", "Bruno", "Alba", "Óscar", "Julia", "Mateo", "Candela", "Rubén", "Lara", "Guillermo",
    ];
    let last_names = [
        "García", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín",
        "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero",
        "Alonso", "Gutiérrez", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil",
    ];
    let provinces = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Segovia", "Cantabria", "Cádiz", "Toledo", "Málaga", "Alicante", "Cuenca", "Huesca"];
    let countries = ["España", "España", "España", "España", "España", "Portugal", "Francia"];
    let genders = ["Femenino", "Masculino", "Femenino", "Masculino", "No binario"];
    let club_names = [
        "Club Atletismo Norte", "Peña Ciclista del Valle", "Club Montaña Alpina",
        "Runners del Puerto", "Club Deportivo Horizonte", "Trail Sierra Verde",
        "Club Náutico Costa", "Atletismo Vega", "Club Ultra Sur", "", "", "Deportes Alameda",
    ];

    let event_modalities: Vec<(i64, Vec<(i64, f64)>)> = {
        let rows: Vec<(i64, i64, f64)> =
            sqlx::query_as("SELECT event_id, id, base_price FROM modalities ORDER BY event_id, id")
                .fetch_all(pool)
                .await?;
        let mut map: Vec<(i64, Vec<(i64, f64)>)> = Vec::new();
        for (event_id, modality_id, price) in rows {
            if let Some(entry) = map.iter_mut().find(|(id, _)| *id == event_id) {
                entry.1.push((modality_id, price));
            } else {
                map.push((event_id, vec![(modality_id, price)]));
            }
        }
        map
    };

    let plan: [(&i64, usize); 5] = [(&1, 32), (&2, 24), (&3, 15), (&5, 20), (&7, 10)];
    let mut sequence: usize = 0;
    for (event_id, count) in plan {
        let Some((_, modality_list)) = event_modalities.iter().find(|(id, _)| id == event_id) else {
            continue;
        };
        for index in 0..count {
            sequence += 1;
            let modality = &modality_list[index % modality_list.len()];
            let first = first_names[sequence % first_names.len()];
            let last = last_names[(sequence * 3) % last_names.len()];
            let email = format!(
                "{}.{}{}@example.test",
                first.to_lowercase().replace('á', "a").replace('é', "e").replace('í', "i").replace('ó', "o").replace('ú', "u"),
                last.to_lowercase().replace('á', "a").replace('é', "e").replace('í', "i").replace('ó', "o").replace('ú', "u"),
                sequence
            );
            let status = if *event_id == 7 {
                "paid"
            } else if index % 10 == 9 {
                "cancelled"
            } else if index % 10 == 8 {
                "pending"
            } else {
                "paid"
            };
            let discount = if *event_id == 1 && index % 7 == 0 {
                (modality.1 * 0.10 * 100.0).round() / 100.0
            } else {
                0.0
            };
            let total = (modality.1 - discount).max(0.0);
            let created = now - Duration::days(((sequence * 5) % 29) as i64);
            let created_at = created.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let coupon_id = if discount > 0.0 { Some(1_i64) } else { None };
            let club_name = club_names[sequence % club_names.len()];
            let shirt_size = ["S", "M", "L", "XL"][sequence % 4];
            let dynamic = json!({
                "shirtSize": shirt_size,
                "emergencyContact": format!("6{:08}", 10000000 + sequence * 37),
                "experience": (sequence % 12) as i64,
                "federation": sequence % 2 == 0
            });
            let registration_id: i64 = sqlx::query_scalar(
                "INSERT INTO registrations (event_id, modality_id, locator, first_name, last_name,
                 email, phone, birth_date, gender, document_id, province, country, club_id,
                 club_name, dynamic_data, base_price, discount, total, coupon_id, status,
                 created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 RETURNING id",
            )
            .bind(*event_id)
            .bind(modality.0)
            .bind(random_code(8))
            .bind(first)
            .bind(last)
            .bind(&email)
            .bind(format!("6{:08}", 20000000 + sequence * 53))
            .bind(format!("19{}-{:02}-{:02}", 70 + sequence % 25, 1 + sequence % 12, 1 + sequence % 27))
            .bind(genders[sequence % genders.len()])
            .bind(format!("{:08}X", 10000000 + sequence * 971))
            .bind(provinces[(sequence * 3) % provinces.len()])
            .bind(countries[sequence % countries.len()])
            .bind(club_name)
            .bind(dynamic.to_string())
            .bind(modality.1)
            .bind(discount)
            .bind(total)
            .bind(coupon_id)
            .bind(status)
            .bind(&created_at)
            .bind(&created_at)
            .fetch_one(pool)
            .await?;
            let order_status = match status {
                "paid" => "completed",
                "cancelled" => "cancelled",
                _ => "pending",
            };
            sqlx::query(
                "INSERT INTO orders (code, registration_id, amount, status, payment_method,
                 reference, payer_name, payer_email, paid_at, created_at)
                 VALUES (?, ?, ?, ?, 'card', ?, ?, ?, ?, ?)",
            )
            .bind(random_code(12))
            .bind(registration_id)
            .bind(total)
            .bind(order_status)
            .bind(if order_status == "completed" { random_code(10) } else { String::new() })
            .bind(format!("{} {}", first, last))
            .bind(&email)
            .bind(if order_status == "completed" { Some(created_at.clone()) } else { None })
            .bind(&created_at)
            .execute(pool)
            .await?;
        }
    }

    // A registration created by claiming the second (already claimed) gift.
    let claimed_gift_id: i64 = sqlx::query_scalar("SELECT id FROM gifts WHERE code = 'REGALOYA01'")
        .fetch_one(pool)
        .await?;
    let claimed_locator = random_code(8);
    let claimed_at = "2026-11-10T12:05:00Z";
    sqlx::query(
        "INSERT INTO registrations (event_id, modality_id, locator, first_name, last_name, email,
         phone, birth_date, gender, document_id, province, country, club_name, dynamic_data,
         base_price, discount, total, gift_id, status, created_at, updated_at)
         VALUES (2, 4, ?, 'Carlos', 'Rueda', 'carlos.rueda@example.test', '611222333',
         '1988-04-12', 'Masculino', '44556677Z', 'Valencia', 'España', 'Runners del Puerto',
         '{\"shirtSize\":\"L\",\"emergencyContact\":\"611222333\"}', 0, 0, 0, ?, 'paid', ?, ?)",
    )
    .bind(&claimed_locator)
    .bind(claimed_gift_id)
    .bind(claimed_at)
    .bind(claimed_at)
    .execute(pool)
    .await?;

    // --- A few outbox messages -------------------------------------------
    let messages = [
        ("ana.vidal@example.test", "Tienes un regalo para Travesía Sierra Norte · REGALO2027", "<p>Ana, Sergio te ha regalado un dorsal. Código: REGALO2027.</p>".to_string()),
        ("carlos.rueda@example.test", "Inscripción confirmada · Maratón Costa Azul", format!("<p>Tu inscripción está confirmada. Localizador: {}.</p>", claimed_locator)),
        ("javier@horizonte.test", "Resumen semanal de inscripciones", "<p>Resumen automático de las inscripciones de la última semana.</p>".to_string()),
    ];
    for (to, subject, body) in messages {
        sqlx::query(
            "INSERT INTO email_outbox (to_email, subject, body, status, created_at)
             VALUES (?, ?, ?, 'sent', ?)",
        )
        .bind(to)
        .bind(subject)
        .bind(body)
        .bind((now - Duration::hours(sequence as i64)).to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .execute(pool)
        .await?;
    }

    println!("Demo data ready. Superadmin: elena@eventmanager.test / admin1234");
    println!("Organizer: javier@horizonte.test / organizer123");
    Ok(())
}

