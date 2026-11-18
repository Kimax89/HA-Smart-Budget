# HA Smart Budget

Et dansk husholdningsbudget til **Home Assistant Apps** og **Docker**. Budgettet fordeler fælles udgifter på tværs af konti, beregner personernes overførsler og bevarer tidligere måneders tal.

- Tilføj og fjern personer, konti, egne kategorier og fælles/personlige udgifter.
- Betalingsdag pr. post og månedlig status: Kommende, Betalt og Overskredet.
- Ligeligt rådighedsbeløb før personlige udgifter som standard.
- Vælg procent af hele puljen, faste beløb eller automatisk rest pr. person.
- Regninger hver 1., 2., 6. eller 12. måned; vælg månedlig hensættelse eller betalingsmåned pr. post.
- Automatisk lagring og gemte månedsversioner, afslutning/genåbning og samlet årsregnskab for afsluttede måneder.
- Lokal SQLite-database; tom opstart uden private data og uden eksterne tjenester.

## Installer i Home Assistant

[Tilføj repositoryet til Home Assistant](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FKimax89%2FHA-Smart-Budget)

Tilføj alternativt repository-URL'en under **Indstillinger → Apps → Installer app → Repositories**. Installer og start **Smart Budget**, og åbn webbrugerfladen. Kræver Supervisor, normalt Home Assistant OS. Understøttede arkitekturer: amd64 og aarch64. Containeren bygges lokalt ved installation.

## Docker

```sh
docker compose up -d --build
```

Åbn `http://localhost:8099`. Data bevares i et Docker-volumen. Standalone-porten er kun tilgængelig på localhost og har ikke eget login.

## Dokumentation og status

Læs [vejledningen](smart_budget/DOCS.md) for beregningsregler, månedshistorik og installation. Version: **0.2.0**. GitHub Actions kontrollerer beregninger, automatisk lagring, SQLite, API, månedsregnskab og containerbygning. Installation på en rigtig Home Assistant-vært skal stadig afprøves.

Home Assistant-konfigurationen følger [App configuration](https://contributors.home-assistant.io/apps/reference/configuration/) og [Ingress](https://contributors.home-assistant.io/apps/guides/ingress/).
