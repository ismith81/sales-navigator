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
          Ook beheer je hier de categorieën (Doelen, Behoeften, Diensten) die in de Navigator verschijnen.
        </p>
        <ul>
          <li>
            <strong>Case importeren</strong> — upload een ingevulde Word-template (<code>case-template.docx</code>).
            De app leest automatisch alle velden uit.
          </li>
          <li>
            <strong>Case bewerken</strong> — klik op een case in de lijst om alle velden aan te passen,
            inclusief rich-text (vet, cursief, lijsten).
          </li>
          <li>
            <strong>Exporteren</strong> — per case kun je een <em>.docx</em> of <em>.pptx</em> downloaden
            in Creates-huisstijl, handig om te delen met collega's of klanten.
          </li>
          <li>
            <strong>Doelen/Behoeften/Diensten</strong> — voeg items toe, hernoem ze of verwijder ze.
            Verwijderen is alleen mogelijk als geen enkele case naar het item verwijst.
          </li>
        </ul>
      </section>

      <section className="ins-section highlight">
        <h3>3. Synchroniseren tussen apparaten (belangrijk!)</h3>
        <p>
          <strong>De app slaat data lokaal op in je browser.</strong> Cases, categorieën en wijzigingen
          die je in jouw browser maakt, zijn <em>niet</em> automatisch zichtbaar voor collega's op andere
          apparaten. Gebruik daarom de backup-functie om de meest actuele data te delen.
        </p>

        <div className="ins-flow">
          <div className="ins-flow-step">
            <div className="ins-step-num">1</div>
            <div className="ins-flow-body">
              <strong>Backup downloaden</strong>
              <p>Ga in <em>Beheer</em> onderaan naar de knop "Backup downloaden".
              Je krijgt een JSON-bestand met alle cases, categorieën en instellingen.</p>
            </div>
          </div>

          <div className="ins-flow-step">
            <div className="ins-step-num">2</div>
            <div className="ins-flow-body">
              <strong>Delen</strong>
              <p>Verstuur het JSON-bestand naar collega's (bv. via Teams of e-mail),
              of bewaar het op een gedeelde locatie (OneDrive / SharePoint).</p>
            </div>
          </div>

          <div className="ins-flow-step">
            <div className="ins-step-num">3</div>
            <div className="ins-flow-body">
              <strong>Backup herstellen</strong>
              <p>Op een ander apparaat: ga naar <em>Beheer</em>, klik onderaan op
              "Backup herstellen" en selecteer het JSON-bestand. Alle data wordt
              overschreven met de nieuwste versie.</p>
            </div>
          </div>
        </div>

        <p className="ins-warning">
          ⚠️ <strong>Let op:</strong> "Backup herstellen" vervangt alle huidige data in de browser.
          Maak zelf eerst een backup als je lokale wijzigingen hebt die je wilt behouden.
        </p>
      </section>

      <section className="ins-section">
        <h3>4. Tips</h3>
        <ul>
          <li>Maak regelmatig een backup, zeker na het toevoegen van nieuwe cases.</li>
          <li>Gebruik korte, herkenbare namen voor Doelen/Behoeften/Diensten — die verschijnen als knoppen tijdens het gesprek.</li>
          <li>Voor elke gemapte tag kun je in de case-editor een <em>match reden</em> opgeven. Dit helpt bij het snel uitleggen waarom een case relevant is.</li>
          <li>De PowerPoint-export is geschikt als inspiratie-slide; pas altijd zelf aan voor het specifieke gesprek.</li>
        </ul>
      </section>
    </div>
  );
}
