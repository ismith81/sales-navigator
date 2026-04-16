---
name: case-generator
description: "Genereer een ingevulde klantcase (.docx) vanuit ruwe tekst. Gebruik deze skill wanneer iemand een klantcase, referentie, of case study wil aanmaken op basis van ongestructureerde input. Triggers: 'case aanmaken', 'referentie verwerken', 'klantcase genereren', 'case template invullen', of wanneer ruwe tekst wordt aangeleverd die over een klantproject gaat met informatie over situatie, oplossing en resultaat. Ook triggeren bij: 'verwerk deze case', 'maak hier een case van', of varianten daarvan."
---

# Case Generator

Genereer een professioneel ingevulde klantcase (.docx) vanuit ruwe, ongestructureerde tekst.

## Workflow

### Stap 1: Structureer de ruwe tekst

Analyseer de aangeleverde tekst en extraheer de volgende velden:

| Veld | Beschrijving |
|------|-------------|
| **Bedrijfsnaam** | Naam van de klant |
| **Korte omschrijving** | Een zin: wat doet dit bedrijf? (bijv. "Europese leverancier van promotionele producten") |
| **Situatie** | Wat was het probleem of de ambitie? Beschrijf de uitgangssituatie. Schrijf helder, bondig, in 2-4 zinnen. |
| **Doel** | Wat moest er bereikt worden? Gewenste eindsituatie. 1-2 zinnen. |
| **Oplossing** | Wat is er gebouwd/gedaan? Architectuur, technische keuzes, aanpak. 3-6 zinnen. |
| **Resultaat** | Wat is er concreet opgeleverd? 1-3 zinnen. |
| **Keywords** | Technische keywords, komma-gescheiden (bijv. "Microsoft Fabric, Databricks, Delta Lake, Power BI") |
| **Business Impact** | Concrete waarde voor de klant: tijdsbesparing, kostenverlaging, betere besluitvorming, etc. 1-3 zinnen. |

### Stap 2: Bepaal de Mapping

Op basis van de inhoud, bepaal welke categorieen van toepassing zijn:

**Doelen** (kies 1 of meer):
- `Meer waarde halen uit data` — als de case gaat over het beter benutten van bestaande data voor rapportage, inzichten, of besluitvorming
- `Data als business model` — als data een directe bron van omzet of dienstverlening wordt (bijv. data-producten, data-gedreven platform voor klanten)

**Behoeften** (kies 1 of meer):
- `Veilig en betrouwbaar` — als security, governance, RBAC, audit logging, datakwaliteit, of betrouwbare rapportage een rol speelt
- `Wendbaar` — als het platform flexibel is, meerdere dataformaten/afnemers ondersteunt, of schaalbaar is
- `AI ready` — als er ML workloads, AI-componenten, of een basis voor toekomstige AI wordt gelegd
- `Realtime data` — als real-time verwerking, streaming, event hubs, of low-latency processing een rol speelt

**Diensten** (kies 1 of meer):
- `Data modernisatie` — als er migratie van legacy-systemen, nieuw dataplatform, of modernisering plaatsvindt
- `Governance` — als er centrale definities, eigenaarschap, Unity Catalog, of data governance wordt ingericht
- `Data kwaliteit` — als er datakwaliteitscontroles, schema-drift detectie, alerting, of datareiniging plaatsvindt
- `Training` — als er kennisoverdracht, workshops, of enablement van het team plaatsvindt

Voor elke geselecteerde optie, schrijf ook een korte toelichting (1 zin) die uitlegt hoe dit terugkomt in de case.

### Stap 3: Vul de template in

Gebruik het Python-script `scripts/fill_template.py` om de template in te vullen:

```bash
python <skill-dir>/scripts/fill_template.py \
  --template <skill-dir>/assets/case-template.docx \
  --output /mnt/user-data/outputs/case-<bedrijfsnaam>.docx \
  --json <path-to-case-data>.json
```

Schrijf eerst het JSON-bestand met deze structuur:

```json
{
  "bedrijfsnaam": "CITO",
  "korte_omschrijving": "Toonaangevend toets- en exameninstituut van Nederland",
  "situatie": "Het bestaande dataplatform was verouderd...",
  "doel": "Het volledige datalandschap moderniseren...",
  "oplossing": "Grootschalige migratie naar Fabric Warehouse & Lakehouse...",
  "resultaat": "Performancewinst van meer dan 8 uur...",
  "keywords": "Microsoft Fabric, Data Migratie, Lakehouse, Warehouse",
  "business_impact": "Van verouderd en traag naar modern en schaalbaar...",
  "mapping": {
    "doelen": {
      "Meer waarde halen uit data": "toelichting hier",
      "Data als business model": ""
    },
    "behoeften": {
      "Veilig en betrouwbaar": "toelichting hier",
      "Wendbaar": "toelichting hier",
      "AI ready": "",
      "Realtime data": ""
    },
    "diensten": {
      "Data modernisatie": "toelichting hier",
      "Governance": "toelichting hier",
      "Data kwaliteit": "",
      "Training": ""
    }
  }
}
```

Lege strings (`""`) bij mapping-items = niet van toepassing (checkbox blijft ☐).
Niet-lege strings = van toepassing (checkbox wordt ☑) en de string is de toelichting.

### Stap 4: Presenteer het resultaat

Lever het ingevulde .docx bestand op. Toon ook een korte samenvatting in de chat zodat de gebruiker kan reviewen.

## Schrijfstijl

- Schrijf in het **Nederlands**
- Gebruik **zakelijke, bondige taal** — geen marketingpraat
- Wees **specifiek**: noem technologieen, aantallen, tijdswinst waar mogelijk
- Corrigeer spelfouten en grammatica uit de ruwe input
- Als informatie ontbreekt, vul dan NIET zelf in — laat het veld leeg en meld dit aan de gebruiker
