# Oleificio Live — applicazione web

App full-stack (Next.js App Router) che serve le API, i tre portali (cliente /
operatore / admin + super admin) e la scena 3D. Integra il motore ETA testato
(`@oleificio/eta-engine`), con autenticazione, RBAC, isolamento tenant, audit log
append-only, notifiche idempotenti, modalità demo e fallback 2D.

> **DB:** SQLite per esecuzione a costo zero in sviluppo. In produzione si usa
> PostgreSQL: basta cambiare `provider`/`url` in `prisma/schema.prisma`. Lo schema
> Postgres di riferimento (con enum e Json nativi) è in `/oleificio-live/prisma/schema.prisma`.

## Avvio rapido

```bash
cd oleificio-live
pnpm install
pnpm --filter @oleificio/eta-engine build   # compila il motore ETA
cd apps/web
npx prisma db push      # crea lo schema SQLite
pnpm seed               # dati demo realistici
pnpm dev                # http://localhost:3000
```

## Credenziali demo

| Ruolo | Accesso |
|-------|---------|
| Cliente | `gverdi` / `cliente123` (username, non email) |
| Operatore | `op1@sanmartino.local` / `op123` |
| Admin oleificio | `admin@sanmartino.local` / `admin123` |
| Super admin | `super@oleificio.local` / `super123` |

## Cosa è implementato e funzionante

- **Autenticazione** a sessione (cookie HttpOnly), hashing password (bcrypt;
  Argon2id è la scelta di produzione documentata), ruoli e guardie RBAC.
- **Isolamento tenant/cliente** applicato nelle query (non solo nella UI): un
  cliente vede solo i propri lotti; un operatore non può usare le API cliente.
- **Ciclo di vita del lotto** con macchina a stati esplicita: creazione da
  conferimento, avvio/pausa/ripresa/completamento fase, avanzamento automatico,
  chiusura lotto, registrazione resa olio. Ogni transizione → evento audit +
  ricalcolo ETA + notifica idempotente. Transazioni DB + optimistic locking
  (`version`, risposta 409 su conflitto).
- **Motore ETA** che simula l'intera linea (fasi continue vs batch, coda,
  priorità, fermi macchina, occupazione vasche) e produce un intervallo +
  affidabilità. Se una macchina necessaria è ferma a tempo indefinito, l'ETA
  diventa "sconosciuta" con affidabilità bassa (mai una data non valida).
- **Portale cliente:** stato del lotto, avanzamento, intervallo ETA + affidabilità,
  scena 3D sincronizzata (con fallback 2D e `prefers-reduced-motion`), timeline,
  notifiche, riepilogo finale con resa.
- **Postazione operatore:** coda/kanban, azioni di fase, registrazione
  conferimento, registrazione resa, controlli **modalità demo** (nuovo lotto,
  avanza, velocità 1x/5x/20x, simula fermo/ripristino gramola).
- **Pannello admin:** macchine e capacità (con avviso "valori DEMO"), fermo/
  ripristino macchina (ricalcola la linea), coda, audit log.
- **Super admin:** elenco oleifici con conteggi.

## Comandi

```bash
pnpm dev         # sviluppo
pnpm build       # build produzione (prisma generate + next build)
pnpm start       # avvia build
pnpm typecheck   # tsc --noEmit (strict)
pnpm test        # test macchina a stati
pnpm seed        # ricarica dati demo
```

## Limiti noti (onesti)

- Realtime tramite polling TanStack Query (5s). Un gateway WebSocket è specificato
  in `docs/api-spec.md`; il polling è sufficiente per la demo.
- 3D procedurale low-poly (nessun GLB esterno pesante): una macchina animata per
  fase con stati e colori, non una replica CAD.
- Provider telemetrici OPC UA / Modbus / MQTT: solo interfacce (nessun registro
  inventato); funzionano Manuale/Mock/HTTP concettualmente — la telemetria demo è
  simulata nel seed.
- Object storage S3, BullMQ, Redis, invio email/SMS reali: previsti nello stack di
  produzione, non necessari per far girare la demo.
