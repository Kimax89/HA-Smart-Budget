# Installation og brug

## Home Assistant

Kræver Home Assistant med Supervisor og understøttelse af Apps, normalt Home Assistant OS. En ren Home Assistant Container kan i stedet bruge den separate Docker-installation.

1. Åbn **Indstillinger → Apps → Installer app** (på ældre versioner: Tilføjelsesprogrammer).
2. Åbn menuen med de tre prikker → **Repositories**.
3. Tilføj `https://github.com/Kimax89/HA-Smart-Budget`.
4. Find **Smart Budget**, installer og start appen. Første installation bygger containeren lokalt og kan tage flere minutter.
5. Vælg **Åbn webbrugerflade**, og slå eventuelt visning i sidepanelet til.

Appen bruger Ingress på intern port 8099, accepterer kun Supervisorens proxy og åbner ingen port på værten. Home Assistant står for login. I denne første version er sidepanelet begrænset til administratorer. Budgetpersoner er beregningspersoner, ikke separate brugerkonti.

SQLite-databasen ligger i appens private `/data/budget.sqlite`. Der kræves ingen cloudtjeneste eller bankforbindelse.

## Første budget

1. Vælg den måned, budgettet begynder i.
2. Under **Personer** opretter du personer og indtægt efter skat. Vælg automatisk fordeling for alle, hvis puljen skal deles ligeligt.
3. Under **Konti** opretter du konti. Tilknyt personlige konti til deres ejer. Konti uden ejer behandles som fælleskonti.
4. Under **Budgetposter** opretter du udgifter. Vælg konto, fælles/personlig, beløb pr. regning, interval, fordelingsform og første måned.
5. Se beregningen i **Overblik**. Når du vælger **Anvend** i en dialog eller fjerner en post, gemmes ændringen automatisk. Status viser **Gemmer…**, **Gemt** eller **Kunne ikke gemme**. Ved fejl bevares ændringerne i browserfanen; vælg **Prøv at gemme igen**.

Personlige udgifter på en personlig konto skal tilhøre kontoens ejer. På en fælleskonto vælger du selv personen; udgiften lægges til denne persons overførsel og trækkes fra personens rådighedsbeløb efter personlige udgifter.

## Kontooverblik på forsiden

Under **Overblik** vises alle konti med deres tilknyttede poster, opdelt i fælles og personlige udgifter. Hver post viser beløbet i den valgte måned. Ved længere betalingsintervaller vises også beløbet pr. regning og fordelingsformen. Poster uden beløb i den valgte måned vises med 0 kr., så alle poster stadig kan findes på deres konto. Hver gruppe har en delsum, og hver konto har en samlet sum.

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

Kræver Node.js 24 LTS. Ingen npm-pakker eller build-trin er nødvendige.

```sh
cd smart_budget
npm test
npm start
```

Standard: `http://127.0.0.1:8099`. Lokal database: `smart_budget/data/budget.sqlite`, som ignoreres af Git. `DATA_DIR`, `HOST` og `PORT` kan sættes i miljøet. `INGRESS_ONLY=true` begrænser adgang til Supervisorens proxy og bruges automatisk i Home Assistant-containeren.

Home Assistant og Docker bruger samme kode. Ved bygning til Home Assistant bruges `Dockerfile`, som sætter Ingress-tilstand. Den separate Compose-installation bruger `Dockerfile.standalone`.

## Første version

Ingen data fra referencearket indgår i repositoryet. Testene bruger opdigtede personer og beløb. Ekstra funktioner som særskilt backup/gendannelse, eksport og ændringslog er ikke implementeret og afventer godkendelse. Version 0.1.2 skal afprøves på en rigtig Home Assistant-installation; en lokal Node-test erstatter ikke denne kontrol.
