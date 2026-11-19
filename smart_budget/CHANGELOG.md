# Ændringslog

## 0.2.5 — 2026-11-19

- Rettet Home Assistant-init: Dockers init anvendes, da appen ikke bruger S6.
- Home Assistant-backup stopper appen midlertidigt, så SQLite kopieres konsistent.
- Home Assistant starter Node som en almindelig bruger efter migrering af ejerskab på eksisterende databasefiler. Historiske budgetter ændres ikke.
- Fast version af Node/Alpine-containeren og fastlåst formatteringsværktøj.
- Adskilt datamodel, validering, betalingsplan og fordeling; ensartet JavaScript, HTML og CSS.
- Ugyldige listeelementer giver en valideringsfejl; nyere databaseversioner afvises uden ændring.
- Statiske filer læses før HTTP-successvar sendes.
- Udvidet CI med App-konfigurationslint, formattering samt test af Ingress, rettigheder, opgradering og vedvarende data.
- Appen er markeret eksperimentel, indtil installation og backup/gendannelse er afprøvet med Supervisor.

## 0.2.4

- Nyt vektorlogo i brugerfladen og ikon til Home Assistant.
