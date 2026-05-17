# Lucid Journal — Notes de projet

## Vision

App personnelle tout-en-un :

- **Timeline** — emploi du temps auto-reconstruit depuis ActivityWatch (PC + Android), vue verticale type Google Calendar avec strates horaires, générée en temps réel
- **Journal** — texte, vocal (Gemini), photos, screenshots Google Keep
- **Tâches** — saisies la veille ou le matin, suivi réalisé vs prévu
- **IA coach/psy** — Gemini lit l'humeur, les patterns, l'historique et donne un feedback brutal/honnête, style anti-procrastination

## Stack

- **Vercel + Next.js** — frontend + API routes
- **Supabase** — données (journal, tâches, activité) + storage (images)
- **Gemini 1.5** — IA : vocal, vision (images), analyse, coaching
- **ActivityWatch** — PC (API locale) + Android ; un script Python sur le PC pousse les données vers Vercel

## Décisions en attente

- Fréquence de sync ActivityWatch : auto toutes les 2h / soir / manuel ?
- PC only ou PC + Android dès le départ pour la timeline ?
- Nom de l'app

## Plan de développement

### Phase 1 — ActivityWatch sync (en cours)

Objectif : afficher l'activité PC + Android dans l'app.

Composants :
1. **Script Python** (sur le PC) — interroge l'API locale ActivityWatch, formate les events, les pousse vers une API route Vercel
2. **API route Next.js** — reçoit les events, les stocke dans Supabase
3. **Table Supabase** `activity_events` — stocke les events bruts
4. **Page/composant Next.js** — affiche la timeline verticale par tranches horaires

### Phases suivantes

- Phase 2 — Journal (texte + vocal Gemini + images)
- Phase 3 — Tâches (saisie + suivi réalisé vs prévu)
- Phase 4 — IA coach (Gemini analyse les patterns)

## Priorité

La timeline ActivityWatch → emploi du temps visuel est le cœur différenciateur. On pose ça en premier.
