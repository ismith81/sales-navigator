import React from 'react';

export default function Instructies() {
  return (
    <div className="instructies">
      <div className="ins-header">
        <h2>Instructies</h2>
        <p>Hoe werk je met de Sales Navigator?</p>
      </div>

      <section className="ins-section">
        <h3>1. Twee routes: Gids en Assistent</h3>
        <p>
          Bovenaan de pagina staat een segmented toggle met twee routes. Kies wat bij jouw
          voorbereiding past — de keuze wordt onthouden voor de volgende keer.
        </p>
        <ul>
          <li>
            <strong>Gids</strong> — klikken door tabs (<em>Doelen</em>, <em>Behoeften</em>, <em>Diensten</em>)
            en filter-knoppen om talking points en relevante cases te zien. Inclusief persona-coach
            "Met wie praat je?". Handig als je gericht een onderwerp of doelgroep wilt verkennen.
          </li>
          <li>
            <strong>Assistent</strong> — een AI-chat die automatisch door alle cases, talking points en
            persona-coaching heen zoekt. Stel gewoon een vraag in natuurlijke taal
            ("Welke cases passen bij AI ready?", "Bereid CFO-gesprek voor over dataplatform-migratie")
            en de assistent zoekt zelf de feiten erbij.
          </li>
        </ul>
        <p>
          Nieuwe gebruikers starten standaard in de Gids-route. De toggle staat altijd boven aan
          de pagina, dus één klik wisselen kan altijd.
        </p>
      </section>

      <section className="ins-section">
        <h3>2. Assistent-route — chat met Nova</h3>
        <p>
          <strong>Nova</strong> is je AI-collega in deze app. Geen algemene chatbot: hij praat
          alleen over de cases, talking points en persona-coaching die hier staan. Feiten
          (bedrijfsnamen, cijfers, tags) komen uit de database — Nova verzint die niet.
        </p>
        <ul>
          <li>
            <strong>Quick-prompts</strong> — onder het welkomstbericht staan drie voorgestelde vragen
            om direct te starten. Klik of typ je eigen vraag.
          </li>
          <li>
            <strong>Klikbare bedrijfsnamen</strong> — als Nova <em>AkzoNobel</em>, <em>CITO</em>,
            <em>Tulp Group</em> of andere case-namen noemt, kun je daarop klikken om direct naar de
            volledige case te springen (de app switcht dan naar de Gids-route met die case geopend).
          </li>
          <li>
            <strong>Persona in je vraag</strong> — in deze route is er geen aparte persona-selector.
            Vermeld de rol gewoon in je vraag ("Ik heb zo een gesprek met een CFO…") en Nova stemt
            het advies daarop af.
          </li>
          <li>
            <strong>Feedback</strong> — bij elk antwoord staan 👍/👎-knoppen. Feedback helpt om de
            systeemprompt en content achter de schermen scherp te stellen.
          </li>
          <li>
            <strong>Geschiedenis</strong> — de chat blijft bewaard binnen deze browser-sessie. Na een
            tab-refresh is 'ie leeg. Er is (nog) geen cross-device geschiedenis.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>3. Gids-route — guided belscript</h3>
        <p>
          De Gids-route is de klikbare belscript-flow. Alles op één pagina, in één kaartje: persona,
          tabs en filter-knoppen.
        </p>
        <ul>
          <li>
            <strong>Met wie praat je?</strong> — linksboven in de kaart zit het persona-kompas
            (Business/Tech × Strategisch/Operationeel). Optioneel — vul alleen in als je weet wie je
            aan de lijn hebt. Levert een coach-tekst ("denk in ROI, vermijd techjargon…") plus
            klantsignalen ("zinnen die typisch bij deze persona horen").
          </li>
          <li>
            <strong>Tabs kiezen</strong> — <em>Doelen</em>, <em>Behoeften</em> of <em>Diensten</em>,
            afhankelijk van waar het gesprek over gaat.
          </li>
          <li>
            <strong>Filter-knop</strong> — klik een onderwerp (bv. "AI ready", "Data modernisatie")
            om talking points, vervolgvragen en relevante cases te zien.
          </li>
          <li>
            <strong>Klantsignalen-toggle</strong> — rechts in de filter-kaart. Laat onder elke
            filter-knop zien welke klantsignalen (zinnen uit het veld) bij dat onderwerp horen.
            Handig bij koud bellen.
          </li>
          <li>
            <strong>Case openen</strong> — onder de filters verschijnt een case-overzicht. Klik op
            een case voor situatie, doel, oplossing, resultaat, keywords en match-redenen per tag.
          </li>
          <li>
            <strong>Zoeken</strong> — de zoekbalk in de topbar (desktop: altijd zichtbaar; mobiel:
            verstopt achter een 🔍-icoon) werkt dwars door alle cases op naam, trefwoord of technologie.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>4. Beheer — cases, categorieën en persona's</h3>
        <p>
          In <strong>Beheer</strong> (rechtsboven in de topbar) beheer je alle content die in beide
          routes verschijnt.
        </p>
        <ul>
          <li>
            <strong>Nieuwe case</strong> — klik op "+ Nieuwe case" voor een lege case die je direct
            in de editor invult.
          </li>
          <li>
            <strong>Case importeren</strong> — upload een ingevulde Word-template
            (<code>case-template.docx</code>, downloadbaar vanuit Beheer). De app leest automatisch
            alle velden uit, inclusief opmaak (vet, cursief, bullet-lijsten) en aangevinkte mapping.
          </li>
          <li>
            <strong>Case bewerken</strong> — klik op een case in de lijst. Alle lange-tekstvelden
            ondersteunen rich text.
          </li>
          <li>
            <strong>Match redenen</strong> — per gemapte tag kun je een korte uitleg geven waarom
            de case daarbij past. Die verschijnt onder de case-titel én Nova gebruikt 'm in antwoorden.
          </li>
          <li>
            <strong>Exporteren</strong> — per case kun je een <em>.docx</em> of <em>.pptx</em>
            downloaden in Creates-huisstijl.
          </li>
          <li>
            <strong>Doelen / Behoeften / Diensten</strong> — voeg items toe, hernoem of verwijder ze.
            Per item leg je talking points, vervolgvragen, een omschrijving en klantsignalen vast.
            Verwijderen kan alleen als geen enkele case ernaar verwijst.
          </li>
          <li>
            <strong>Persona's</strong> — beheer de 4 standaard-kwadranten en voeg eventueel extra
            persona's toe. Per persona leg je icoon, voorbeeldrollen, omschrijving, klantsignalen
            en coaching-tekst vast.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>5. Opslag &amp; synchronisatie</h3>
        <p>
          De app werkt met een <strong>centrale database</strong> (Supabase). Alle cases, categorieën,
          talking points, persona's en feedback worden automatisch opgeslagen en zijn direct zichtbaar
          voor iedereen die de app opent — op elk apparaat, zonder import of export.
        </p>
        <p>
          Wijzigingen verschijnen vrijwel direct (binnen een seconde). Er is geen handmatige
          synchronisatie nodig.
        </p>
      </section>

      <section className="ins-section">
        <h3>6. Lokale snapshot (optioneel)</h3>
        <p>
          Onderaan in <em>Beheer</em> staan twee knoppen:
          <strong> Backup downloaden</strong> en <strong>Backup herstellen</strong>.
          Die zijn <em>geen</em> vervanging voor de database, maar een vangnet:
        </p>
        <ul>
          <li>
            <strong>Backup downloaden</strong> — slaat een JSON-snapshot op van wat er nu in de
            database staat (cases, categorieën, topics én persona's). Handig als je een tussenversie
            wilt bewaren voordat je grotere wijzigingen maakt.
          </li>
          <li>
            <strong>Backup herstellen</strong> — laadt een eerder gedownloade JSON terug.
            Let op: dit <strong>overschrijft</strong> de huidige database-inhoud voor iedereen.
            Gebruik alleen bij disaster recovery of bewuste rollback.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>7. Tips</h3>
        <ul>
          <li>
            <strong>Niet zeker waar te beginnen?</strong> Begin in de Assistent-route met een open
            vraag — die leidt je vanzelf naar de juiste cases en onderwerpen.
          </li>
          <li>
            <strong>Bekend onderwerp?</strong> Gids-route is sneller: 2–3 klikken en je hebt
            talking points + cases op het scherm.
          </li>
          <li>
            Gebruik korte, herkenbare namen voor Doelen/Behoeften/Diensten — die verschijnen als
            knoppen tijdens het gesprek.
          </li>
          <li>
            Vul match redenen zoveel mogelijk in: die maken direct duidelijk waarom een case
            relevant is, en Nova haalt er z'n onderbouwing uit.
          </li>
          <li>
            Persona-coaching werkt alleen goed als je 'm ook echt invult — laat 'm anders leeg,
            dan verschijnt er geen helper.
          </li>
          <li>
            Geef 👍/👎 op Nova's antwoorden — dat is de snelste manier om content-gaten
            (ontbrekende cases, zwakke talking points) op te sporen.
          </li>
          <li>
            Maak voor grote wijzigingen eerst een lokale snapshot (zie punt 6), zodat je kunt
            terugrollen.
          </li>
        </ul>
      </section>
    </div>
  );
}
