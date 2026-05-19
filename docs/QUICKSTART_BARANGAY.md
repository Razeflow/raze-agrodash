# Raze AgroDash — Barangay Quick-Start

> One-page guide for the barangay extension worker. Print double-sided.
>
> **Pilot contact:** [your name + mobile + SMS-friendly hours]

> **For the dev before printing:** fill in the four placeholders — pilot contact (top + §10), deployment URL (§1), feedback channel (§10). Replace `[example.gov.ph]` with the real URL once known. Then print double-sided on A4 or US Letter.

---

## What this is

AgroDash is the Municipal Agriculture Office's record book for your barangay — moved off paper. You'll use it to:

- Keep your farmers' list up to date
- Log each planting (rice, corn, fishery, livestock, etc.)
- Mark harvests and damages as they happen
- Print or export your barangay's monthly numbers

You see **only your own barangay** — never anyone else's. That's by design.

---

## 1) Sign in

1. Open **[https://example.gov.ph](https://example.gov.ph)** in any browser (phone or laptop is fine). *(Dev: replace with real URL before printing.)*
2. Username and password were given to you in person. Don't share them.
3. If the screen says "**Your session expired**", just sign in again — your work isn't lost.

> The first time you sign in on a new phone, the page may take 5–10 seconds. After that it's fast.

---

## 2) Find your way around

The left side of the screen has tabs. You'll mostly use these three:

| Tab | What's here |
|---|---|
| **Overview** | Today's totals for your barangay — number of farmers, planted hectares, harvested bags. |
| **Farmers** | The people you serve. Add new farmers, edit their details, attach planting-area lots. |
| **Records** | One row per planting cycle. This is where you spend most of your time. |

Skip **Programs**, **Activity**, **Management**, **Users** — those are for the municipal office.

---

## 3) Register a new farmer (when someone joins your registry)

1. Tab: **Farmers** → button **Register Farmer**.
2. Fill in:
   - **Last / First / Middle name** — at least last + first.
   - **Gender**, **Birth date**, **Civil status** (optional).
   - **RSBSA number** if they have one.
   - **Household** — pick an existing household or leave blank to create a new one.
3. **Save**. You'll see "Farmer registered" and the form clears so you can add another.

⚠ If the system says **"Possible duplicate"**, double-check — same name + RSBSA usually means this farmer already exists. Click **Add Anyway** only if it's a genuinely different person.

> Forgot a field? Open the farmer from the Farmers tab and click **Edit**.

---

## 4) Add a planting record

This is the most common task — once per farmer per planting cycle.

1. Tab: **Records** → button **Add Record**.
2. Fill in:
   - **Reporting Month / Year** — when did the planting / stocking happen?
   - **Commodity** (Rice, Corn, Fishery, etc.) — picks the right form.
   - **Farmers** — tap "Select farmers from registry" and pick everyone who works this plot.
   - **Planting area (ha)** for crops, OR **Stocking** for fishery / livestock.
3. Set **Status** to **Currently Growing**.
4. **Save Changes**.

If the system blocks you with a red message:

- *"All farmers must belong to the same household"* → you picked farmers from two different households. Pick one household at a time.
- *"No planting-area assets on file"* → first add a "Planting area" lot under the farmer's profile (Farmers → Edit → Assets), then come back.
- *"Allocation exceeds household capacity"* → the household's total farming hectares are already used up by other active records. Finalize an old one first.

---

## 5) When something changes

### When the planting is harvested

1. Find the record on the **Records** tab → click **Edit**.
2. Fill in **Harvest (bags)** or fishery / livestock output.
3. Change **Status** to **Harvest Recorded**.
4. **Save Changes**. The system will ask you to confirm — once finalized, the numbers are locked in for monthly reports.

### When the planting is damaged (≥50% loss)

1. Edit the record.
2. Fill in the damage (hectares lost to pests, diseases, or calamities).
3. Change **Status** to **Damaged**.
4. Save and confirm.

### Old records you don't need to see anymore

Use **Status → Closed (Historical)**. It hides them from the active view but keeps them for historical reports. You can always search for them later.

---

## 6) Status pills — what they mean

You'll see these colored pills next to every record:

| Pill | Meaning |
|---|---|
| **Currently Growing** | Crop / fishery / livestock is still in the ground / pond / pen. No harvest recorded yet. |
| **Harvest Recorded** | This cycle has been harvested. The record is finalized — numbers are locked. |
| **Damaged (≥50% loss)** | Significant loss. Treated as the end of this cycle. |
| **Closed (Historical)** | Read-only. Past record kept for history and monthly reports. |

The system will let you **edit while Currently Growing**. Once a record is **Harvest Recorded** or **Closed**, the numeric fields are locked — this is to protect monthly reports from being changed accidentally.

---

## 7) "Wait, I didn't mean to do that"

### You started typing but want to cancel
- Click **Cancel** or the **X**. If the form has unsaved typing, you'll see "**Discard unsaved changes?**" — click **Discard** to throw it away, or **Keep editing** to stay.

### You deleted a farmer / record / household by accident
- It's not gone forever. Tell the municipal office — they have a 90-day "trash bin" they can restore from.

### The screen looks frozen or shows "Something went wrong"
- Reload the page (pull down to refresh, or press F5). Your work that was saved is still safe.
- If reload doesn't help, SMS the pilot contact at the top of this page.

### You're not sure if your last save worked
- Check the **Records** tab — if the record is there with your new values, it saved. If you don't see it, it didn't save. (No record is created with partial data.)

---

## 8) Tips that save time

- **Phones work, but landscape is easier** for the Records form.
- **The Farmers tab** has a search box and a barangay filter — use them.
- **Export to PDF / CSV** from the Overview tab — useful for monthly meetings at the municipal office.
- **Don't worry about typos in old records** — flag them to the municipal office instead of trying to fix everything yourself.
- **One record per planting cycle, not per harvest event.** Re-use the same record from planting through harvest by editing its status.

---

## 9) Common questions

**Q: Can I see other barangays?**
No. You only see your own. The municipal office sees everyone.

**Q: Two farmers married each other and now share a household. What do I do?**
Edit each farmer → set the same household. The system handles the rest.

**Q: I made the wrong status change.**
While **Currently Growing**, you can change back. Once **Harvest Recorded** or **Closed**, ask the municipal office to revert it.

**Q: A field I need isn't on the form.**
Tell the pilot contact. We'll add it if it's needed for monthly reports.

**Q: My RSBSA list is out of date.**
That's fine — RSBSA is optional. Add it when you have a verified number.

**Q: I can't sign in.**
Double-check Caps Lock. Then SMS the pilot contact — passwords can be reset.

---

## 10) Where to get help

| Need | Who |
|---|---|
| Can't sign in, screen is broken, you're stuck | **Pilot contact:** [name] · [mobile] · SMS preferred, **[hours]** |
| Question about a farmer / household / record | Municipal Agriculture Office front desk |
| Suggest a change to the system | SMS the pilot contact above. We'll add a Feedback link in the footer once it's ready. |
| Print the monthly report | Overview tab → **Print** button |

---

*Raze AgroDash · Municipal Agriculture Office · Tubo, Abra · Region CAR*
*This is the pilot version. Things will improve based on your feedback.*
