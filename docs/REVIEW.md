# Home Assistant- og kodegennemgang

Gennemgået 19. november 2026 for version 0.2.5. Dette dokument angiver både rettelser, valg og grænser for valideringen. Det er ikke en certificering fra Home Assistant.

## Home Assistant

| Område og officiel vejledning | Vurdering og handling |
| --- | --- |
| [Repository](https://contributors.home-assistant.io/apps/guides/repository/) og [filer](https://contributors.home-assistant.io/apps/reference/files/) | repository.yaml i roden; separat appmappe med config.yaml, Dockerfile, README, DOCS, ikon og nu CHANGELOG. Ingen brugerdata i repositoryet. |
| [Konfiguration](https://contributors.home-assistant.io/apps/reference/configuration/) | Navn, slug, version, beskrivelse og amd64/aarch64 er angivet. Version synkroniseres med package.json. Ingen unødige host-, hardware-, API- eller mappeadgange. |
| [Dockerfile](https://contributors.home-assistant.io/apps/guides/dockerfile/) | Node-baseimage er tilladt. Fast Node/Alpine-version. Dockers standard-init er nu aktiv uden S6. Standardværdier er udeladt fra konfigurationen. Supervisor tilføjer image-labels ved lokal bygning. Ingen deprecated build.yaml. |
| [S6](https://contributors.home-assistant.io/apps/guides/s6-overlay/) | Ikke anvendt; én Node-proces under Dockers init. Ingen S6-konfiguration er nødvendig. |
| [Ingress](https://contributors.home-assistant.io/apps/guides/ingress/) | Intern port 8099, kun faktisk afsender 172.30.32.2 tilladt. Relative browser-URL'er, ingen hostport, ingen ekstra loginformular. panel_admin bevares. Proxyheaders giver ikke selv adgang. |
| [Runtime](https://contributors.home-assistant.io/apps/reference/environment/) og backup-konfiguration | SQLite i vedvarende /data. backup: cold for konsistent kopi af database og WAL. Node kører uden root efter en snæver ejerskabsmigrering ved start. options.json røres ikke. |
| [Sikkerhed](https://contributors.home-assistant.io/apps/guides/security/) og [rating](https://contributors.home-assistant.io/apps/reference/security-rating/) | Protection mode og Dockers standard-AppArmor bevares. Ingen Docker-socket, Supervisor-tokenbrug, host network eller ekstra capabilities. En specialtilpasset AppArmor-profil er en anbefalet videre hærdning, men kræver observation på en HA-vært før håndhævelse. Den er ikke tilføjet uden sådan afprøvning. |
| [Indstillinger](https://contributors.home-assistant.io/apps/guides/options/) | Ingen options/schema er nødvendige; budgetdata lagres gennem appen. Ingen konfigurationsfelter eller porte kræver oversættelsesfiler. |
| Hardware, Core/Supervisor API, services/discovery | Ikke anvendt. Tilsvarende rettigheder skal fortsat være deaktiverede. |
| [Præsentation](https://contributors.home-assistant.io/apps/guides/presentation/) | Dokumentation, licenshenvisning, supportlink, kendte begrænsninger og ændringslog. Transparent ikon. stage: experimental indtil Supervisor-test er udført. |
| [Publicering](https://contributors.home-assistant.io/apps/guides/publishing/) | Lokal bygning er understøttet og oplyst. Forbyggede, signerede registry-images er en anbefalet fremtidig distributionsforbedring; der angives ingen image-reference til et image, som ikke er publiceret. |
| [Test](https://contributors.home-assistant.io/apps/guides/testing/) | CI bygger begge Dockerfiles for amd64/arm64. Native containertest af proxyadgang, afvist direkte adgang, root-ejede opgraderingsdata, genstart og almindelig Node-bruger. Automatiske tests erstatter ikke en fuld Supervisor-test. |

## Clean Code

Hele projektets kildekode, tests, styling, containerfiler, CI og dokumentation er gennemgået. Ansvar er adskilt uden at ændre de offentlige beregningsfunktioner: model.js definerer fælles typer/konstanter, validation.js normaliserer input, payments.js håndterer betalingsrytme og datoer, budget.js fordeler puljen og beregner overførsler, store.js håndterer transaktioner/historik, server.js håndterer HTTP. Fordelingspolitikken er trukket ud af den samlede beregningsfunktion.

JavaScript, HTML og CSS er formatteret ensartet med fastlåst Prettier og CI-kontrol. Valideringsfejl giver kontrollerede fejl frem for TypeError. Databasen afviser ukendt nyere skemaversion og lukker forbindelsen ved initialiseringsfejl. Statiske filer læses før successvar. Penge beregnes fortsat i hele øre, og procentprodukter bruger BigInt. Transaktioner, samtidighedskontrol, historiske snapshots og de eksisterende brugerflows bevares.

Browser-controlleren er fortsat frameworkfri. Den har visning, formularer og hændelser samlet; en fuld komponentomskrivning ville være en større arkitekturændring uden dokumenteret behov. Controllerens faktiske hændelser testes med en DOM-adapter og den rigtige database; dette er ikke en visuel browsertest.

## Kontrol på en Home Assistant-vært

Følgende er ikke verificeret af lokal Node eller almindelig Docker-CI og skal afprøves med Supervisor, før appen betegnes som stabil:

1. Tilføj repository, installer på amd64 og aarch64 og kontroller loggen med protection mode slået til.
2. Åbn via Ingress og sidepanel; kontroller dialoger, relative moduler og adgang efter login/logout.
3. Opdater en eksisterende installation med gemte/låste måneder; kontroller indkomst, poster og regnskab.
4. Tag Home Assistant-backup inklusive appen. Gendan den og kontroller åbne/låste måneder samt registrerede betalinger.
5. Stop/start og genstart værten; kontroller bevaring af data og fravær af AppArmor-fejl i værtsloggen.

Ingen nye budgetfunktioner eller ændringer af fordeling/design er indført ved denne gennemgang.
