# Ingress-adgang i Smart Budget

Undersøgt 21. november 2026 mod Supervisor 2026.11.0 og Home Assistants officielle dokumentation.

## Home Assistants kontrol

`ingress: true` aktiverer proxyen. `panel_admin` har standardværdien true og bestemmer, om panelet er forbeholdt administratorer. Smart Budget har eksplicit `panel_admin: false`. [Konfigurationsreference](https://contributors.home-assistant.io/apps/reference/configuration/).

Det er mere end visning: Supervisor validerer Ingress-sessionen, finder brugeren og returnerer HTTP 403, hvis panel_admin er true og brugeren ikke er administrator. Ved false fjernes denne administratorbegrænsning; Home Assistants login og session er stadig nødvendige. [Supervisor 2026.11.0, Ingress-handler](https://github.com/home-assistant/supervisor/blob/2026.11.0/supervisor/api/ingress.py#L160).

panel_admin er app-metadata. Supervisors schema for ændring af brugerindstillinger indeholder ingress_panel (vis/skjul i sidepanelet), men ikke panel_admin. Derfor ændrer en brugerindstilling i Smart Budget ikke dynamisk Supervisors panelregistrering. [Supervisor options-schema](https://github.com/home-assistant/supervisor/blob/2026.11.0/supervisor/api/apps.py).

## Valgfri adgangsbegrænsning fra 0.2.10

Åbn **Indstillinger → Apps → Smart Budget → Konfiguration**. Indstillingen **Adgang til Smart Budget** har værdierne:

- `all`: alle indloggede Home Assistant-brugere. Dette er standard og bevarer den hidtidige adgang.
- `admins`: kun administratorer. Smart Budget håndhæver begrænsningen for hele HTTP-serveren, inklusive API og statiske filer. Menupunktet kan stadig vises for andre brugere.

Gem og genstart appen. Indstillinger læses fra /data/options.json før tjenesten skifter til en almindelig bruger. Ingen databaseændring eller ekstra Supervisor/Core API-rettigheder er nødvendig. [Officiel vejledning om indstillinger](https://contributors.home-assistant.io/apps/guides/options/).

Administratorvalget kræver, at Supervisor sender X-Remote-User-Id og X-Remote-User-Groups med system-admin. Denne adfærd er verificeret i Supervisor 2026.11.0. Supervisor filtrerer browserens tilsvarende headers og indsætter selv brugeroplysningerne. Ejere får også administratorgruppen i de effektive grupper. Smart Budget stoler kun på oplysningerne fra den faktiske proxyadresse 172.30.32.2. [Headerbehandling](https://github.com/home-assistant/supervisor/blob/2026.11.0/supervisor/api/ingress.py#L355), [effektive grupper](https://github.com/home-assistant/supervisor/blob/2026.11.0/supervisor/const.py#L597).

Manglende eller ugyldige administratoroplysninger giver afslag i admins-tilstand. På en ældre Supervisor uden gruppeheader skal du opdatere Supervisor eller vælge all i Home Assistants App-konfiguration og genstarte appen. Du kan ændre denne indstilling uden at åbne Smart Budgets Ingress.

Indstillingen gælder kun Home Assistant-installationen. Standalone Docker har fortsat localhost-binding og eget reverse-proxybehov ved ekstern adgang; denne indstilling indfører ikke login til standalone.

## Kontrol efter installation

1. Installer/opdater Smart Budget, og vælg all. Slå **Vis i sidepanelet** til på appens infoside.
2. Log ind med en almindelig, aktiv Home Assistant-bruger, og åbn Smart Budget fra sidepanelet. Kontroller også brugerens personlige sidepanelindstillinger, hvis menupunktet er skjult.
3. Vælg admins, gem og genstart. Administratoren skal fortsat kunne bruge budgettet; den almindelige bruger skal få afslag, også på direkte API-forespørgsler.
4. Vælg all igen, gem og genstart, hvis alle skal have adgang.

Automatiske tests dækker politik, proxygrænse, manglende grupper, eksisterende indstillinger og HTTP-læsning/-ændring i container. En simuleret proxy er ikke en test af din installerede Home Assistant-session eller sidepanelregistrering.
