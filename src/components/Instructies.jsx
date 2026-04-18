import React from 'react';

export default function Instructies() {
  return (
    <div className="instructies">
      <div className="ins-header">
        <h2>Instructies</h2>
        <p>Hoe werk je met de Sales Navigator?</p>
      </div>

      <section className="ins-section">
        <h3>1. De Navigator gebruiken</h3>
        <p>
          De Navigator is bedoeld om tijdens een salesgesprek snel de juiste talking points
          en vervolgvragen bij de hand te hebben. Zodra je de pagina opent zie je meteen
          de talking points van het eerste onderwerp — geen extra klikken nodig om te starten.
        </p>
        <ul>
          <li>
            <strong>Kies een tab</strong> — <em>Doelen</em>, <em>Behoeften</em> of <em>Diensten</em> — afhankelijk van
            het gespreksonderwerp. Binnen een tab wordt altijd automatisch het eerste onderwerp geopend.
          </li>
          <li>
            <strong>Klik op een ander onderwerp</strong> (bv. "AI ready" of "Data modernisatie") om de
            bijbehorende talking points, vervolgvragen en relevante klantcases te zien.
          </li>
          <li>
            <strong>Klap een case open</strong> om details te lezen: situatie, doel, oplossing, resultaat
            en match redenen.
          </li>
          <li>
            <strong>Zoekbalk bovenin</strong> — typ een klantnaam, trefwoord of technologie om direct
            relevante cases te vinden, dwars door alle categorieën heen.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>2. Met wie praat je? — de persona-coach</h3>
        <p>
          Links bovenin staat het kompas "Met wie praat je?". Dit is een <strong>optionele
          coach-laag</strong>: hij bepaalt niet wélke content je ziet, maar wel hóe je 'm brengt.
          Standaard ingeklapt — open als je weet wie je aan de lijn hebt.
        </p>
        <ul>
          <li>
            <strong>2×2-kompas</strong> — persona's zijn verdeeld over domein (Business / Tech)
            en niveau (Strategisch / Operationeel). Voorbeeldrollen (CFO, Data engineer, ...) staan
            als geheugensteun onder elke persona.
          </li>
          <li>
            <strong>Coaching-tip</strong> — kies een persona en er verschijnt een stijl-instructie
            ("Denk in ROI, vermijd techjargon, …"). Gebruik dit om je eigen taal af te stemmen.
          </li>
          <li>
            <strong>Herkenningspunten</strong> — onder de coaching kun je klantsignalen tonen:
            citaten die typisch bij deze persona horen. Handig bij koud bellen om snel te plaatsen
            met wie je praat.
          </li>
          <li>
            <strong>Wissen</strong> — persona blijft alleen actief tijdens deze sessie, refresh of
            "Wissen" zet 'm uit.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>3. Beheer — cases, categorieën en persona's</h3>
        <p>
          In <strong>Beheer</strong> richt je alle content in die in de Navigator verschijnt.
        </p>
        <ul>
          <li>
            <strong>Nieuwe case</strong> — klik op "+ Nieuwe case" voor een lege case
            die je direct in de editor invult.
          </li>
          <li>
            <strong>Case importeren</strong> — upload een ingevulde Word-template
            (<code>case-template.docx</code>). De app leest automatisch alle velden uit,
            inclusief opmaak (vet, cursief, bullet-lijsten).
          </li>
          <li>
            <strong>Case bewerken</strong> — klik op een case in de lijst om alle velden
            aan te passen. Alle lange-tekstvelden ondersteunen rich text.
          </li>
          <li>
            <strong>Match redenen</strong> — per gemapte tag kun je in de editor een korte
            uitleg geven waarom de case daarbij past. Die verschijnt in de Navigator onder
            de case-titel.
          </li>
          <li>
            <strong>Exporteren</strong> — per case kun je een <em>.docx</em> of <em>.pptx</em>
            downloaden in Creates-huisstijl, handig om te delen met collega's of klanten.
          </li>
          <li>
            <strong>Doelen / Behoeften / Diensten</strong> — voeg items toe, hernoem ze of
            verwijder ze. Per item kun je talking points, vervolgvragen, een omschrijving en
            klantsignalen vastleggen. Verwijderen kan alleen als geen enkele case ernaar verwijst.
          </li>
          <li>
            <strong>Persona's</strong> — beheer de 4 standaard-kwadranten (Business/Tech ×
            Strategisch/Operationeel) en voeg eventueel extra persona's toe (verschijnen als
            "Overige"-chips onder het kompas). Per persona leg je icoon, voorbeeldrollen,
            omschrijving, klantsignalen en coaching-tekst vast.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>4. Opslag &amp; synchronisatie</h3>
        <p>
          De app werkt met een <strong>centrale database</strong> (Supabase). Alle cases,
          categorieën, talking points en persona's worden automatisch opgeslagen en zijn
          direct zichtbaar voor iedereen die de app opent — op elk apparaat, zonder import
          of export.
        </p>
        <p>
          Wijzigingen verschijnen vrijwel direct (binnen een seconde) in de database.
          Er is geen handmatige synchronisatie nodig.
        </p>
      </section>

      <section className="ins-section">
        <h3>5. Lokale snapshot (optioneel)</h3>
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
        <h3>6. Tips</h3>
        <ul>
          <li>Gebruik korte, herkenbare namen voor Doelen/Behoeften/Diensten — die verschijnen als knoppen tijdens het gesprek.</li>
          <li>Vul match redenen zoveel mogelijk in: die maken direct duidelijk waarom een case relevant is bij een specifieke tag.</li>
          <li>Persona-coaching werkt alleen goed als je 'm ook echt invult — laat 'm anders leeg, dan verschijnt er geen helper.</li>
          <li>De PowerPoint-export is geschikt als inspiratie-slide; pas altijd zelf aan voor het specifieke gesprek.</li>
          <li>Maak voor grote wijzigingen eerst een lokale snapshot (zie punt 5), zodat je kunt terugrollen.</li>
        </ul>
      </section>
    </div>
  );
}
