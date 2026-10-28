# Design prototype (reference only)

The Claude Design export the production site was built from: `AOS Site v7`, the admin, two landing pages and the prototype's data layer (`aos-data.js`),
plus `HANDOFF.md` with the business rules. It is a localStorage prototype, **not production code**. The real implementation is in `../src` and `../supabase`.

Left out of this copy:

- the demo tenant and member accounts (`AOS Tenant Area.dc.html` and `demoLogin`),
- the prototype's seeded admin account and its password hash,
- the note about that account's initial password,
- uploaded images that no design file references (including editing-session screenshots).

Open the `.dc.html` files with their `support.js` runtime. The `_ds` folder is the Industry design system the export shipped with; the site itself uses its own styles (`../src/styles`).
