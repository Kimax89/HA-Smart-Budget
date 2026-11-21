# Installation og brug

## Home Assistant

Kræver Home Assistant med Supervisor og understøttelse af Apps, normalt Home Assistant OS. En ren Home Assistant Container kan i stedet bruge den separate Docker-installation.

1. Åbn **Indstillinger → Apps → Installer app** (på ældre versioner: Tilføjelsesprogrammer).
2. Åbn menuen med de tre prikker → **Repositories**.
3. Tilføj `https://github.com/Kimax89/HA-Smart-Budget`.
4. Find **Smart Budget**, installer og start appen. Første installation bygger containeren lokalt og kan tage flere minutter.
5. Vælg **Åbn webbrugerflade**, og slå eventuelt visning i sidepanelet til.

Appen bruger Ingress på intern port 8099, accepterer kun Supervisorens proxy og åbner ingen port på værten. Home Assistant står for login. Ingress-panelet er tilgængeligt for alle brugere, der er logget ind i Home Assistant. Som standard har alle adgang til det samme budget og kan rette i åbne måneder. Adgangen kan begrænses i appens konfiguration som beskrevet nedenfor. Budgetpersoner er beregningspersoner, ikke separate brugerkonti.

SQLite-databasen ligger i appens private `/data/budget.sqlite`. Der kræves ingen cloudtjeneste eller bankforbindelse.

Navigationen til Overblik, Budgetposter, Personer, Konti og Regnskab findes i burgermenuen øverst til højre. Menuen kan betjenes med tastatur og lukkes med Escape eller ved klik udenfor.

## Adgang for Home Assistant-brugere

Under **Indstillinger → Apps → Smart Budget → Konfiguration** kan **Adgang til Smart Budget** sættes til `all` (alle indloggede brugere, standard) eller `admins` (kun administratorer). Kontakten **Administratorer kan redigere, øvrige brugere kan kun se Overblikket** (`admins_edit`) kan slås til eller fra her. Slå den til sammen med `ingress_access: all` for kun at give administratorer redigeringsadgang; øvrige brugere kan se Overblikket og skifte måned. Slå den fra for at give alle med adgang mulighed for at redigere. Valget `ingress_access: admins` har altid forrang og begrænser hele adgangen til administratorer. Gem og genstart appen. Begrænsningen gælder både sider og API; Home Assistants menupunkt kan fortsat være synligt for alle. I admins_edit skjules appens egen menu og redigeringshandlinger for læsebrugere. De kan ikke åbne Regnskab, markere betalinger eller afslutte/genåbne måneder.

Administratorvalget kræver Supervisor med understøttelse af brugergrupper, verificeret i Supervisor 2026.11.0. Hvis grupper mangler, afvises adgangen. Opdater da Supervisor, eller vælg `all` og genstart. Home Assistants App-konfiguration kan tilgås af administratoren, selv om Smart Budgets Ingress afviser adgang. Standalone Docker påvirkes ikke af indstillingen.

Se [undersøgelsen af Ingress](../docs/INGRESS.md) for kilder, forskellen på sidepanel og adgang samt kontrol med en almindelig bruger. Slå **Vis i sidepanelet** til på appens infoside, hvis Smart Budget ikke vises.

## Opret budgettet

1. Vælg den måned, budgettet begynder i.
2. Under **Personer** opretter du personer og indtægt efter skat. Vælg automatisk fordeling for alle, hvis puljen skal deles ligeligt.
3. Under **Konti** opretter du konti. Tilknyt personlige konti til deres ejer. Konti uden ejer behandles som fælleskonti.
4. Under **Budgetposter** opretter du udgifter. Vælg konto, fælles/personlig, beløb pr. regning, interval, fordelingsform og første måned.
5. Se beregningen i **Overblik**. Når du vælger **Anvend** i en dialog eller fjerner en post, gemmes ændringen automatisk. Status viser **Gemmer…**, **Gemt** eller **Kunne ikke gemme**. Ved fejl bevares ændringerne i browserfanen; vælg **Prøv at gemme igen**.

Personlige udgifter på en personlig konto skal tilhøre kontoens ejer. På en fælleskonto vælger du selv personen; udgiften lægges til denne persons overførsel og trækkes fra personens rådighedsbeløb efter personlige udgifter.

## Kontooverblik på forsiden

Under **Overblik** vises alle konti med deres tilknyttede poster, opdelt i fælles og personlige udgifter. Hver post viser beløbet i den valgte måned. Ved længere betalingsintervaller vises også beløbet pr. regning og fordelingsformen. Poster uden beløb i den valgte måned vises med 0 kr., så alle poster stadig kan findes på deres konto. Hver gruppe har en delsum, og hver konto har en samlet sum. Klik på et personnavn eller navnet på en budgetpost for at rette den direkte. Det virker på forsiden og i de relevante lister. I afsluttede måneder er navnene ikke redigerbare; genåbn først måneden.

## Kontoikoner og foldbare kontooversigter

Hver konto viser et ikon og månedens samlede budgetudgift til højre for kontonavnet. Standardvalget **Automatisk** bruger et hus til en fælleskonto og en person til en personlig konto. Under **Konti** kan du klikke på kontoens navn eller vælge **Ret** for at redigere den. Klik på kontonavnet i overblikket bruges kun til at folde posterne sammen og ud. I kontoens redigering kan du vælge mellem hus, person, personer, pung, sparegris, bank, betalingskort, bil, indkøb og arbejde. Automatisk følger kontotypen, hvis ejeren ændres; et eksplicit valgt ikon bevares.

Klik på kontoens overskrift for at folde budgetposterne sammen eller ud. Kontoens samlede beløb er altid synligt. Når kontooversigten kun har bredde til én konto pr. række, starter kontiene klappet sammen. På bredere visninger starter de åbne. Dine manuelle valg bevares særskilt for smalt og bredt layout i den valgte måned, mens siden er åben; ved genindlæsning bruges standardvisningen igen. Ikonvalg gemmes automatisk med månedsversionen.

## Fordeling

Puljen er alle indtægter minus alle fælles udgifter, uanset konto.

- **Automatisk rest**: Resten deles ligeligt mellem de personer, som bruger automatisk fordeling.
- **Procent af hele puljen**: 10 % og 90 % betyder direkte 10/90-fordeling, ikke et tillæg til en ligelig fordeling.
- **Fast rådighedsbeløb**: Personen får det angivne beløb før personlige udgifter.

Procenter og faste beløb kan kombineres. Eksempel: en person får 20 % af puljen, en anden får et fast beløb, og en tredje får den automatiske rest. Uden automatiske personer skal de valgte beløb og procenter fordele puljen præcist. Programmet viser fejl og tillader ikke afslutning ved en ugyldig fordeling. Et åbent budget med fordelingsfejl kan gemmes som kladde.

Overførsel = indkomst − fælles udgifter fra egne konti − tildelt rådighedsbeløb + personlige udgifter betalt fra fælleskonti.

Et negativt overførselsbeløb betyder, at personen skal modtage penge fra fællespuljen. Programmet viser nettobidrag og behov på hver fælleskonto; det vælger ikke selv, hvordan bankoverførsler fordeles mellem flere fælleskonti, og udfører ingen overførsler.

## Regninger med intervaller

Beløbet er pr. regning, og intervallet kan være 1, 2, 6 eller 12 måneder.

- **Fordelt pr. måned**: en årlig regning på 12.000 kr. bliver til et budgetbeløb på 1.000 kr. pr. måned.
- **Kun i betalingsmåneden**: samme regning indgår med 12.000 kr. i startmåneden og derefter hver 12. måned.

Første måned er også ankeret for betalingsintervallet. Posten tæller ikke før den måned. Fordelt pr. måned er en budgetmæssig hensættelse, ikke registrering af en bankbetaling. Det samlede regnskab viser de budgetterede beløb efter den valgte fordelingsform, ikke importerede banktransaktioner.

Alle beløb opbevares i hele øre. Hvis en regning ikke kan deles præcist, fordeles de overskydende øre på de første måneder i intervallet. Eksempel: 100 kr. hvert halve år bliver 16,67 kr. i fire måneder og 16,66 kr. i to måneder. Der mistes ingen øre.

## Betalingsdag og betalingsstatus

Hver budgetpost har en betalingsdag fra 1 til 31. Standard er den 1., også for eksisterende poster. Hvis dagen ikke findes i måneden, bruges månedens sidste dag, eksempelvis 28. eller 29. februar. Datoer vurderes i tidszonen Europe/Copenhagen.

Under **Budgetposter** vises betalingsdato og status:

- **Kommende**: Betalingsdatoen er i dag eller senere.
- **Overskredet**: Betalingsdatoen er passeret, og posten er ikke markeret betalt.
- **Betalt**: Du har valgt **Markér betalt**. Brug **Markér ubetalt** for at rette en fejl.

Markeringen gemmes automatisk og gælder kun den valgte måned. Den videreføres ikke til efterfølgende måneder. Betalingsstatus er en manuel registrering og ændrer ikke budgetbeløbet eller rådighedsfordelingen. Der udføres ingen bankoverførsel. Afsluttede måneder er låst; genåbn dem før en betalingsmarkering ændres.

Betalingsintervallet afgør den faktiske betalingsmåned, uanset om budgetbeløbet er fordelt pr. måned. En årlig regning viser derfor kun en betalingsdato og betalingsstatus i den årlige betalingsmåned. Øvrige måneder viser **Ingen betaling denne måned**, selv om de indeholder en hensættelse. Flyttes betalingsdag, første betalingsmåned eller interval i redigeringsdialogen, fjernes en eventuel betalingsmarkering for den post i den valgte måned.

## Egne budgetkategorier

Åbn **Kategorier** i menuen eller **Budgetposter → Administrer kategorier**. Opret og navngiv kategorierne selv; der oprettes ingen standardkategorier. I budgetpostens kategorifelt kan du vælge et eksisterende navn eller skrive et nyt kategorinavn direkte. Et nyt navn oprettes først sammen med budgetposten, når du vælger **Anvend**, og begge gemmes i samme databasehandling. Annullerer du dialogen, oprettes kategorien ikke. Et eksisterende navn genbruges, også hvis store/små bogstaver eller mellemrum omkring navnet er forskellige. Lad feltet være tomt for **Uden kategori**. Kategorier er uafhængige af både konto og fælles/personlig. Kategorioversigten viser antal poster og månedens samlede budgetbeløb.

Du kan omdøbe og fjerne kategorier. Flyt først tilknyttede poster til en anden kategori eller **Uden kategori**, hvis kategorien skal slettes. Kategorier gemmes med månedsversionen og videreføres som udgangspunkt til næste måned. Ændringer påvirker ikke andre gemte måneder.

## Måneder, ændringer og historik

En måned uden egen gemt version tager udgangspunkt i den senest gemte tidligere måned. Indtægter, personer, konti og poster videreføres; intervaller beregnes for den valgte måned.

Automatisk lagring opretter eller ændrer kun den valgte månedsversion. Tidligere måneder ændres ikke. Allerede gemte fremtidige måneder ændres heller ikke. En fremtidig måned uden egen version tager udgangspunkt i den seneste gemte version før den. Arbejd derfor med månederne i rækkefølge for et sammenhængende budget.

Ret en posts beløb i den måned, hvor ændringen skal gælde, og vælg **Anvend**. Ændringen gemmes automatisk. Behold første betalingsmåned, hvis betalingsrytmen er den samme. Du kan fjerne personer, konti og poster fra en måned uden at fjerne dem fra tidligere gemte måneder. Flyt eller fjern tilknyttede konti og poster, før du fjerner en person eller konto.

**Afslut måned** gemmer ændringerne, validerer fordelingen og låser månedens tilstand og beregning. **Regnskab** summerer kun afsluttede måneder i det valgte år. Brug månedsvælgeren til at skifte regnskabsår. **Genåbn måned** gør måneden redigerbar og fjerner den fra regnskabet, indtil den afsluttes igen.

Hvis budgettet har underskud, vises en advarsel. Automatisk fordeling kan vise et negativt rådighedsbeløb. Dette skjules ikke ved kunstigt at sætte beløbet til nul.

## Docker uden Home Assistant

Fra repositoryets rod:

```sh
docker compose up -d --build
```

Åbn `http://localhost:8099`. Docker-udgaven binder kun porten på localhost. Data gemmes i Docker-volumenet `budget-data` (Compose kan sætte projektnavn foran). Undlad at slette volumenet, hvis data skal bevares. Standalone-udgaven har ikke eget login; behold localhost-bindingen, eller sæt en autentificeret reverse proxy foran ved adgang fra andre computere.

## Lokal udvikling

Kræver Node.js 24 LTS. Selve programmet kræver ingen npm-pakker eller build-trin. npm ci installerer kun udviklingsværktøjet til formattering.

```sh
cd smart_budget
npm test
npm start
```

Standard: `http://127.0.0.1:8099`. Lokal database: `smart_budget/data/budget.sqlite`, som ignoreres af Git. `DATA_DIR`, `HOST` og `PORT` kan sættes i miljøet. `INGRESS_ONLY=true` begrænser adgang til Supervisorens proxy og bruges automatisk i Home Assistant-containeren.

Home Assistant og Docker bruger samme kode. Ved bygning til Home Assistant bruges `Dockerfile`, som sætter Ingress-tilstand. Den separate Compose-installation bruger `Dockerfile.standalone`.

## Første version

Programmet starter med et tomt budget. Testene bruger opdigtede personer og beløb. Ekstra funktioner som særskilt backup/gendannelse, eksport og ændringslog er ikke implementeret og afventer godkendelse. Version 0.2.12 skal afprøves på en rigtig Home Assistant-installation; en lokal Node-test erstatter ikke denne kontrol.

## Drift, backup og support

Home Assistant inkluderer appens /data i backups, når appen vælges til backup. Appen stoppes kort under backup (cold backup), så SQLite-filerne kan kopieres konsistent. Opdateringer bevarer /data; afinstallation og sletning af Docker-volumen kan fjerne data. Ved manuel kopi skal appen først stoppes, og hele datamappen skal kopieres. En gendannelse skal afprøves før man stoler på sin backup.

Node-tjenesten kører som en almindelig bruger. Ved første start efter opdatering fra den gamle Home Assistant-container ændres ejerskabet kun på datamappen og programmets SQLite-filer. Budgetindholdet ændres ikke. Et program afviser databaser med en ukendt nyere skemaversion frem for at nedgradere dem.

Fejl rapporteres i [GitHub Issues](https://github.com/Kimax89/HA-Smart-Budget/issues). Undlad personlige budgetdata og tokens i fejlrapporter. Programmet er udgivet under [GPL-3.0](https://github.com/Kimax89/HA-Smart-Budget/blob/main/LICENSE); kontoikonerne har deres egen ISC-licens i public/icons/LICENSE.

Udviklingskontrol: kør npm ci, npm run format:check og npm test i smart_budget. Prettier er kun en udviklingsafhængighed; containeren installerer ingen npm-pakker. Se også [gennemgangen](../docs/REVIEW.md) for afgrænsning og Supervisor-testplan.

Ved åbning vælges den aktuelle måned. Er den afsluttet, vises den efterfølgende måned i stedet. Du kan stadig vælge afsluttede måneder manuelt.

Dark mode slås til og fra med kontakten til venstre for menuknappen. Headerens farver bevares. Valget gemmes i den aktuelle browser; nye browsere starter i lyst tema.
