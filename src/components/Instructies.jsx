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
          en vervolgvragen bij de hand te hebben.
        </p>
        <ul>
          <li>
            <strong>Kies een tab</strong> — <em>Doelen</em>, <em>Behoeften</em> of <em>Diensten</em> — afhankelijk van
            het gespreksonderwerp.
          </li>
          <li>
            <strong>Klik op een onderwerp</strong> (bv. "AI ready" of "Data modernisatie") om de bijbehorende
            talking points, vervolgvragen en relevante klantcases te zien.
          </li>
          <li>
            <strong>Klap een case open</strong> om details te lezen: situatie, doel, oplossing, resultaat
            en match redenen.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>2. Beheer — cases en categorieën</h3>
        <p>
          In <strong>Beheer</strong> kun je cases toevoegen, bewerken en verwijderen.
          Ook beheer je hier de categorieën (Doelen, Behoeften, Diensten) en de pijnpunten
          die onder elke behoefte verschijnen.
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
            verwijder ze. Verwijderen kan alleen als geen enkele case naar het item verwijst.
          </li>
          <li>
            <strong>Pijnpunten per behoefte</strong> — onder elke behoefte kun je klanttaal-
            hints toevoegen. Die verschijnen als voorbeeldzinnen in de Navigator om het
            gesprek te helpen herkennen.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>3. Opslag & synchronisatie</h3>
        <p>
          De app werkt met een <strong>centrale database</strong> (Supabase). Alle cases,
          categorieën, pijnpunten en wijzigingen worden automatisch opgeslagen en zijn
          direct zichtbaar voor iedereen die de app opent — op elk apparaat, zonder import
          of export.
        </p>
        <p>
          Wijzigingen verschijnen vrijwel direct (binnen een seconde) in de database.
          Er is geen handmatige synchronisatie nodig.
        </p>
      </section>

      <section className="ins-section">
        <h3>4. Lokale snapshot (optioneel)</h3>
        <p>
          Onderaan in <em>Beheer</em> staan twee knoppen:
          <strong> Backup downloaden</strong> en <strong>Backup herstellen</strong>.
          Die zijn <em>geen</em> vervanging voor de database, maar een vangnet:
        </p>
        <ul>
          <li>
            <strong>Backup downloaden</strong> — slaat een JSON-snapshot op van wat er nu in de
            database staat. Handig als je een tussenversie wilt bewaren voordat je grotere
            wijzigingen maakt.
          </li>
          <li>
            <strong>Backup herstellen</strong> — laadt een eerder gedownloade JSON terug.
            Let op: dit <strong>overschrijft</strong> de huidige database-inhoud voor iedereen.
            Gebruik alleen bij disaster recovery of bewuste rollback.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>5. Tips</h3>
        <ul>
          <li>Gebruik korte, herkenbare namen voor Doelen/Behoeften/Diensten — die verschijnen als knoppen tijdens het gesprek.</li>
          <li>Vul match redenen zoveel mogelijk in: die maken direct duidelijk waarom een case relevant is bij een specifieke tag.</li>
          <li>De PowerPoint-export is geschikt als inspiratie-slide; pas altijd zelf aan voor het specifieke gesprek.</li>
          <li>Maak voor grote wijzigingen eerst een lokale snapshot (zie punt 4), zodat je kunt terugrollen.</li>
        </ul>
      </section>
    </div>
  );
}
