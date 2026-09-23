# MX Field Tracker — Cloudflare Pages

Premium live work-shift tracking dashboard for field representatives.

## Deploy
1. Cloudflare > Workers & Pages > Create > Pages > Connect to Git.
2. Repository: mazenmix/windows-cleaner
3. Production branch: main
4. Root directory: mx-field-tracker-web
5. Framework preset: None
6. Build command: leave blank
7. Build output directory: .
8. Create a D1 database named mx-field-tracker-db.
9. Run schema.sql in the D1 Console.
10. In the Pages project add a D1 binding named exactly DB.
11. Add an encrypted environment variable named exactly ADMIN_KEY with a long password.
12. Redeploy.
13. Open the pages.dev URL and sign in with ADMIN_KEY.

Use the + button to add each employee. The site generates a one-time Tracking Key for the Android app.

Tracking is shift-based and visible to the employee through Android's foreground tracking notification.