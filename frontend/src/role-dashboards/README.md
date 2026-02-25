# Role Dashboard Folder

Add one file per role using this name format:

- `admin.dashboard.js`
- `manager.dashboard.js`
- `editor.dashboard.js`

Each file should export:

```js
export default {
  role: "manager",
  title: "Manager Dashboard",
  subtitle: "Custom text",
  highlights: ["Card text 1", "Card text 2", "Card text 3"],
};
```

The app loads these files automatically with `import.meta.glob`.
If a role has no file, a fallback dashboard is shown automatically.

Automatic creation:
- Roles are read from `backend/constants/roles.js` by `npm run sync:roles`.
- `npm run dev` and `npm run build` run this sync automatically.
- Missing files are created once and never overwritten.
