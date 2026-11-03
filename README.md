# Pew Pew: carpooling app

Riders find a seat, drivers post rides. Built with Next.js, Spring Boot, Neon (Postgres) and Clerk.

## What it does
- Post a ride in a **pool car** or an **e-rickshaw**: route, stops, date and time slot
- The driver enters the **total fare in rupees**; it is split between the riders (4000 for 4 riders = 1000 each)
- Riders can **make an offer**; offers below the driver's lowest price are turned down
- Riders going the same way can **ask for a stop**; the driver accepts or declines
- Search by "from" and "to"; booked rides look like boarding passes
- A **console** with rider and driver modes; you can only delete your own rides

## Folders
- `frontend/` Next.js app
- `backend/` Spring Boot API (talks to Neon)

## Run it

### 1. Backend
1. Create a Postgres database on [Neon](https://neon.tech).
2. In `backend/src/main/resources/`, copy `application-example.properties` as described inside it
   (`application.properties` + `application-local.properties`).
3. Put your Neon values and your Clerk **JWKS URL** in them.
4. Run `Main.java` (or `mvn spring-boot:run`) and open http://localhost:8080/db-check

The tables are created automatically.

### 2. Frontend
1. In `frontend/`, create `.env.local` with your Clerk keys:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```
2. `npm install` then `npm run dev`, and open http://localhost:3000

## Troubleshooting
- **401 when booking or posting:** the backend rejected the Clerk login. Check the backend console for
  `LOGIN TOKEN REJECTED`. "Jwt used before ..." means your computer clock is wrong: sync it.
- **Never commit** `application.properties`, `application-local.properties` or `.env.local`.
