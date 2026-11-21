# Ændringslog

## 0.2.10 — 2026-11-21

- Ny Home Assistant-indstilling ingress_access: all (standard) eller admins. Gem og genstart for at ændre adgangen.
- panel_admin: false bevares, så sidepanelet kan vises for alle. Administratorbegrænsning håndhæves på alle appens sider og API-ruter, men skjuler ikke sidepanelet.
- Brugergrupper fra den verificerede Supervisor-proxy bruges uden ekstra API-rettigheder. Manglende grupper afvises i administratortilstand.
- Tilføjet adgangstests og containertest med root-ejet options.json samt forsøg på uautoriseret læsning og ændring.

## 0.2.9 — 2026-11-21

- Byttet kolonnerne Til fællespuljen og Fælles fra egen konto på Overblikket.
- Overførsler vises med fed blå tekst, indtægter med fed grøn tekst. Blåtonen tilpasses dark mode for læsbarhed.
- Personer og budgetposter vises alfabetisk med dansk sortering. Rækkefølgen i budgetdata og fordelingen af øre ændres ikke.

## 0.2.8 — 2026-11-19

- Ingress-panelet er tilgængeligt for alle indloggede Home Assistant-brugere med panel_admin: false.

## 0.2.7 — 2026-11-19

- Dark mode med en tilgængelig toggle til venstre for menuen. Valget gemmes lokalt i browseren. Headerens farver bevares.

## 0.2.6 — 2026-11-19

- Ved åbning vises næste måned, hvis den aktuelle måned er afsluttet. Manuel månedsnavigation er uændret.

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
