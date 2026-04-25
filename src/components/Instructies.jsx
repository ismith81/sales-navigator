import React from 'react';

// Instructies-pagina met drie secties (Algemeen / Nova / Beheer).
// De sub-nav zit in de topbar (Navigator.jsx) en stuurt de actieve sectie
// via de `section`-prop mee.
export default function Instructies({ section = 'algemeen' }) {
  return (
    <div className="instructies">
      {section === 'algemeen' && <TabAlgemeen />}
      {section === 'nova' && <TabNova />}
      {section === 'beheer' && <TabBeheer />}
    </div>
  );
}

function TabAlgemeen() {
  return (
    <>
      <section className="ins-section">
        <h3>1. Inloggen</h3>
        <p>
          De Sales Navigator is afgeschermd: je hebt een account nodig. Nieuwe collega's
          krijgen een invite-mail vanuit Supabase; daarmee stel je je wachtwoord in.
        </p>
        <ul>
          <li>
            <strong>Wachtwoord</strong> — inloggen gaat standaard met e-mail + wachtwoord.
          </li>
          <li>
            <strong>Magic link</strong> — geen wachtwoord paraat? Klik
            "Stuur mij een login-link" op het loginscherm en klik door vanuit je mail.
          </li>
          <li>
            <strong>Wachtwoord vergeten</strong> — via "Wachtwoord vergeten?" krijg je een
            reset-link. Na klikken kun je meteen een nieuw wachtwoord instellen.
          </li>
          <li>
            <strong>Uitloggen</strong> — het icoon rechtsboven in de balk.
          </li>
        </ul>
        <p>
          Je sessie blijft actief, ook na herladen. Na langere tijd van inactiviteit
          moet je opnieuw inloggen.
        </p>
      </section>

      <section className="ins-section">
        <h3>2. Twee routes: Gids en Assistent</h3>
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
            <strong>Assistent</strong> — een AI-chat met <strong>Nova</strong> die automatisch door
            alle cases, talking points en persona-coaching heen zoekt. Zie de Nova-tab voor details.
          </li>
        </ul>
        <p>
          Nieuwe gebruikers starten standaard in de Gids-route. De toggle staat altijd boven aan
          de pagina, dus één klik wisselen kan altijd.
        </p>
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
            (Business/Tech × Strategisch/Operationeel). Start <em>ingeklapt</em> — klik op de titel
            om 'm open te klappen. Optioneel; vul alleen in als je weet wie je aan de lijn hebt.
            Levert een coach-tekst ("denk in ROI, vermijd techjargon…") plus klantsignalen
            ("zinnen die typisch bij deze persona horen").
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
            <strong>Case openen</strong> — onder de filters verschijnt een case-overzicht. Zonder
            filter zie je alle cases; zodra je een filter kiest verandert de titel in "Referenties
            voor …". Klik op een case voor situatie, doel, oplossing, resultaat, keywords en
            match-redenen per tag.
          </li>
          <li>
            <strong>Zoeken</strong> — de 🔍-knop zit rechtsboven in de topbar en is op elke breedte
            ingeklapt. Klik 'm open om een zoekveld uit te vouwen; typen switcht automatisch naar de
            Navigator-view en zoekt dwars door alle cases op naam, trefwoord of technologie.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>4. Opslag &amp; synchronisatie</h3>
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
        <h3>5. Lokale snapshot (optioneel)</h3>
        <p>
          Onderaan in <em>Beheer → Cases</em> zit een inklapbaar blok
          <strong> "Backup &amp; herstel"</strong>. Klik open en je ziet
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
          <li>
            <strong>Niet zeker waar te beginnen?</strong> Begin in de Assistent-route met een open
            vraag — Nova leidt je vanzelf naar de juiste cases en onderwerpen.
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
            Maak voor grote wijzigingen eerst een lokale snapshot (zie punt 5), zodat je kunt
            terugrollen.
          </li>
        </ul>
      </section>
    </>
  );
}

function TabNova() {
  return (
    <>
      <section className="ins-section">
        <h3>Wie is Nova?</h3>
        <p>
          <strong>Nova</strong> is je AI-collega in deze app. Geen algemene chatbot: ze praat
          alleen over de cases, talking points en persona-coaching die hier staan. Feiten
          (bedrijfsnamen, cijfers, tags) komen altijd uit de database — Nova verzint die niet.
        </p>
        <p>
          Nova is géén bibliothecaris die cases opsomt. Ze is een <strong>sparring-partner</strong>:
          ze combineert wat ze uit de database haalt tot concreet advies voor jouw gesprek. Vraag
          niet "welke cases passen?", vraag "wat zeg ik tegen deze CFO volgende week?".
        </p>
      </section>

      <section className="ins-section">
        <h3>Wat Nova voor je kan doen</h3>
        <p>
          Elf skills die je proactief kunt inzetten — stel de vraag gewoon in natuurlijke taal,
          Nova herkent zelf wat voor type verzoek het is.
        </p>
        <ul>
          <li>
            <strong>Voorbereiding</strong> — compleet mini-belscript: opening, discovery-vragen,
            relevante case, bezwaren, afsluiting.<br />
            <em>Voorbeeld:</em> "Bereid een gesprek voor met de CDO van een verzekeraar over AI-readiness."
          </li>
          <li>
            <strong>Synthese</strong> — combineert een case en een persona tot een openingszin of
            pitch op maat.<br />
            <em>Voorbeeld:</em> "Hoe open ik richting een CFO met een migratie-case?"
          </li>
          <li>
            <strong>Rollenspel</strong> — Nova speelt de persona, valt aan op zwakke plekken, blijft
            in karakter tot je "stop" zegt.<br />
            <em>Voorbeeld:</em> "Speel de IT-manager van een bank en val me aan op governance."
          </li>
          <li>
            <strong>Checklist / review</strong> — plak je pitch of mailconcept, Nova toetst 'm
            tegen de talking points en follow-ups en noemt wat ontbreekt.<br />
            <em>Voorbeeld:</em> "Ik heb deze opening geschreven: [...]. Wat mis ik nog?"
          </li>
          <li>
            <strong>Vergelijken</strong> — zet meerdere cases naast elkaar per doel, sector of aanpak.<br />
            <em>Voorbeeld:</em> "Zet twee cases uit de retail naast elkaar qua aanpak."
          </li>
          <li>
            <strong>Follow-up mail</strong> — maakt van ruwe gespreksnotities een kort mailconcept in Creates-toon,
            inclusief samenvatting en voorstel voor de volgende stap.<br />
            <em>Voorbeeld:</em> "Maak van deze notes een follow-up mail voor de prospect."
          </li>
          <li>
            <strong>Actielijst uit notities</strong> — haalt uit notes een concrete markdown-checklist
            met eigenaar, actie en open punten.<br />
            <em>Voorbeeld:</em> "Zet deze gespreksnotities om naar een actielijst."
          </li>
          <li>
            <strong>Prospect-briefing (7-bucket raamwerk)</strong> — vraag een briefing over een bedrijf
            en Nova levert een gestructureerd rapport in vaste categorieën:
            <em>Bedrijfssnapshot · Strategische prioriteiten · Data-volwassenheid (Gartner DMM-stage)
            · AI-initiatieven · Team & sourcing-houding · Concurrentiepositie · Buying signals & budget</em>.
            Afsluitend een <strong>BANT-samenvatting</strong> (Budget, Authority, Need, Timeline) +
            <strong>Sales-fit</strong> (openingshoek) + <strong>Gap-flag</strong> (eerlijk waar Creates
            zwak staat). Achter elk web-feit staat een klein <strong>[n]</strong>-citatie-nummer
            (klik = scroll naar bron + flash); onderaan het antwoord verschijnt een ingeklapte
            chip <strong>"N bronnen ▾"</strong> die je open kunt klikken voor de volledige genummerde
            bronnenlijst. Alleen publiek web; géén LinkedIn-scrapes of CRM-data.<br />
            <em>Voorbeeld:</em> "Maak een briefing over Bol.com." (de structuur volgt automatisch)
          </li>
          <li>
            <strong>Gap-analyse</strong> — vraag Nova om een kritische blik op Creates' eigen portfolio
            tegenover de prospect-realiteit. Ze scant alle cases + persona's en benoemt concreet waar
            we zwak of leeg staan, met een ontwikkel-aanbeveling. Eerlijker dan "en wij kunnen dit
            ook" — helpt pitches scherper en geloofwaardiger maken.<br />
            <em>Voorbeeld:</em> "Waar hebben we gaten t.o.v. Bol.com? Wat zouden we moeten ontwikkelen?"
          </li>
          <li>
            <strong>Team-match</strong> — Nova zoekt in jullie consultant-profielen
            (Beheer → Team) en geeft top 3 collega's met een specifieke motivatie waarom
            ze passen bij de klantvraag (welke skills/technologies/sectors/projecten
            matchen). Eindigt met een sales-fit-regel + eerlijk gat als geen kandidaat
            alle vereisten dekt. Werkt zowel met losse vragen ("wie heeft Fabric-ervaring?")
            als geplakte tender-tekst ("we zoeken een senior data engineer met …").<br />
            <em>Voorbeelden:</em> "Welke collega heeft Fabric-ervaring in retail?"  ·
            "Wie kan ik meenemen naar een gesprek over een dataplatform?"  ·
            [tender-paragraaf plakken] "Match deze klantvraag met onze collega's."
          </li>
          <li>
            <strong>Klantgerichte profielpitch</strong> — Nova schrijft een korte (3–4 zinnen)
            paragraaf over één collega die je in offertes/voorstellen kunt plakken.
            Gebaseerd op de klantgerichte samenvatting uit z'n profiel + relevante
            projectervaring + skills. Derde persoon, professioneel-zelfverzekerd, geen
            marketing-jargon.<br />
            <em>Voorbeeld:</em> "Schrijf een pitch voor Niels voor een Power BI Embedded-traject."
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Hoe je het meeste uit Nova haalt</h3>
        <ul>
          <li>
            <strong>Quick-prompts</strong> — onder het welkomstbericht staan vier voorgestelde vragen
            om direct te starten. Handig als je niet meteen weet hoe je het wilt formuleren.
          </li>
          <li>
            <strong>Context in je vraag</strong> — noem de rol (CFO, CDO, IT-manager), de sector
            (retail, bank, overheid) en het onderwerp. Hoe specifieker, hoe beter het antwoord.
          </li>
          <li>
            <strong>Voor notes-taken: plak ruw, niet perfect</strong> — je hoeft notities niet eerst
            op te schonen. Nova kan losse bullets, halve zinnen en actiepunten omzetten naar nette output.
          </li>
          <li>
            <strong>Nova mag context bijtrekken</strong> — bij follow-up mails en actielijsten kan Nova
            relevante persona-, topic- of case-context ophalen als jouw notes daar aanleiding toe geven.
            Zo wordt de output minder generiek en beter passend bij het gesprek.
          </li>
          <li>
            <strong>Persona in de vraag, niet in een selector</strong> — in de Assistent-route is
            er geen aparte persona-kompas. Vermeld de rol gewoon in je vraag.
          </li>
          <li>
            <strong>Doorvragen mag</strong> — Nova is een chat, niet een zoekmachine. Vraag om een
            kortere versie, een andere toon, of "geef me ook de tegenargumenten".
          </li>
          <li>
            <strong>Eindig een rollenspel expliciet</strong> — typ "stop" of "uit rol" om Nova uit
            karakter te halen en feedback te vragen op hoe je het deed.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Klikbare bedrijfsnamen</h3>
        <p>
          Als Nova een case-naam noemt (standaard in <strong>vet</strong>), kun je daarop klikken
          om direct naar de volledige case te springen. De app switcht dan naar de Gids-route met
          die case geopend.
        </p>
        <p>
          Ook bij notes-taken geldt: als Nova een relevant referentie-haakje toevoegt op basis van
          een echte case, blijft die bedrijfsnaam klikbaar zodat je de onderliggende case kunt checken.
        </p>
      </section>

      <section className="ins-section">
        <h3>Web-bronnen &amp; citaties</h3>
        <p>
          Als Nova externe info ophaalt (typisch bij prospect-briefings) plaatst ze achter elk feit
          een klein <strong>[n]</strong>-nummer als citatie. Onderaan het antwoord verschijnt een
          ingeklapte chip met <em>"N bronnen ▾"</em>; klik 'm open voor de volledige genummerde
          lijst.
        </p>
        <ul>
          <li>
            <strong>Klik op een [n]-nummer</strong> in de tekst — bronnen-blok klapt automatisch
            open en scrollt naar bron #n met een korte flash-highlight.
          </li>
          <li>
            <strong>Klik op een bron-titel</strong> in het uitgeklapte blok — opent de originele
            webpagina in een nieuw tabblad.
          </li>
          <li>
            <strong>Bronnen alleen voor publiek web</strong> (Google Search). Bij interne content
            uit Creates' eigen cases/topics/personas verschijnen géén [n]-citaties — die zijn
            immers geen externe bron.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Feedback &amp; geschiedenis</h3>
        <ul>
          <li>
            <strong>Feedback</strong> — bij elk antwoord staan 👍/👎-knoppen. Dit is de snelste
            manier om content-gaten (ontbrekende cases, zwakke talking points) en promptfouten
            op te sporen. Gebruik 'm ook gewoon voor "dit antwoord was perfect" — dat helpt ook.
          </li>
          <li>
            <strong>Chatgeschiedenis</strong> — je gesprekken worden bewaard in de cloud, gekoppeld
            aan jouw account. Op desktop zit de geschiedenis in een sidebar links; op mobiel open
            je 'm via de hamburger ☰ in de chat-header. Klik op een eerder gesprek om verder te
            gaan, of open het ⋮-menu naast de titel voor <em>Vastpinnen</em>, <em>Hernoemen</em>
            of <em>Verwijderen</em>. Cross-device: laptop én telefoon zien dezelfde historie.<br />
            <strong>Limiet:</strong> 20 gewone gesprekken. Bij een 21e wordt de oudste automatisch
            opgeruimd. <strong>Vastgepinde gesprekken</strong> tellen daar niet voor mee — die
            blijven altijd staan, ook als je veel chat. Pin dus een gesprek dat je belangrijk
            vindt (bv. een nog lopende prospect-briefing).
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Wat Nova (nog) niet doet</h3>
        <ul>
          <li>Nova verzint geen cases, cijfers of klantnamen — als iets niet in de database staat, zegt ze dat.</li>
          <li>Nova raadpleegt via Google Search alléén publieke webpagina's voor prospect-briefings. Ze logt niet in op LinkedIn of CRM-systemen en leest geen commerciële of gevoelige data.</li>
          <li>Nova onthoudt niets tussen sessies of apparaten. Memory-laag staat op de roadmap.</li>
          <li>Nova kan wel mailtekst opstellen, maar nog geen slide-decks of mails als bestand opleveren — alleen tekst in de chat.</li>
        </ul>
      </section>
    </>
  );
}

function TabBeheer() {
  return (
    <>
      <section className="ins-section">
        <h3>Structuur van Beheer</h3>
        <p>
          <strong>Beheer</strong> zit rechtsboven in de topbar en heeft drie sub-tabs die in de
          subnav eronder verschijnen:
        </p>
        <ul>
          <li><strong>Cases</strong> — de klantcases zelf, inclusief backup/herstel.</li>
          <li><strong>Onderwerpen</strong> — doelen, behoeften en diensten met hun talking points,
            vervolgvragen, omschrijving en klantsignalen.</li>
          <li><strong>Persona's</strong> — de vier kwadranten (plus eventuele extra's) met iconen,
            rollen en coaching-tekst.</li>
          <li><strong>Team</strong> — consultant-profielen (CV's). Upload een PDF en de structuur
            wordt automatisch ingelezen, of vul handmatig in. Zie hieronder voor details.</li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Cases</h3>
        <p>
          Beheer → Cases bevat alle klantcases. De tabel toont per case de gekoppelde tags
          (Doelen · Behoeften · Diensten met hun kleur-dot), status (compleet/incompleet) en
          actie-iconen rechts.
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
            <strong>Exporteren</strong> — per case kun je een <em>.docx</em>
            downloaden in Creates-huisstijl.
          </li>
        </ul>
      </section>

      <section className="ins-section">
        <h3>Doelen, Behoeften &amp; Diensten</h3>
        <p>
          Voeg items toe, hernoem of verwijder ze. Per item leg je <strong>talking points</strong>,
          <strong> vervolgvragen</strong>, een <strong>omschrijving</strong> en <strong>klantsignalen</strong> vast.
          Verwijderen kan alleen als geen enkele case ernaar verwijst.
        </p>
        <p>
          Alle content die je hier invult verschijnt in de Gids-route én wordt gebruikt door Nova
          als feitenbron.
        </p>
      </section>

      <section className="ins-section">
        <h3>Persona's</h3>
        <p>
          Beheer de 4 standaard-kwadranten (Business/Tech × Strategisch/Operationeel) en voeg
          eventueel extra persona's toe. Per persona leg je icoon, voorbeeldrollen, omschrijving,
          klantsignalen en coaching-tekst vast.
        </p>
        <p>
          <strong>Icoon kiezen:</strong> klik op de icoon-knop in het persona-paneel om de
          icon-picker te openen — een raster met curated Lucide-iconen. Kies er een, klaar.
          Bestaande emoji-persona's worden automatisch gekoppeld aan een passend Lucide-icoon;
          je kunt handmatig upgraden via de picker.
        </p>
        <p>
          De coaching-tekst verschijnt in de Gids-route als je een persona selecteert. De
          klantsignalen helpen je te herkennen <em>wie</em> je aan de lijn hebt op basis van wat
          ze zeggen.
        </p>
      </section>

      <section className="ins-section">
        <h3>Team — consultant-profielen</h3>
        <p>
          Beheer → Team is de plek voor de profielen van collega's: wie heeft welke expertise,
          welke certificaten, in welke sectoren ervaring, en welke projecten heeft 'ie gedaan.
          Sales gebruikt dit om snel de juiste collega aan een klantvraag te koppelen
          (matching komt later via Nova; in deze fase is 't een doorzoekbaar overzicht).
        </p>
        <ul>
          <li>
            <strong>+ CV uploaden</strong> — upload een PDF, Nova haalt er automatisch de
            structuur uit (naam, rol, senioriteit, kernskills, technologieën, sectoren,
            projectervaring, certificaten + een klantgerichte 2–3 zinnen-samenvatting).
            Daarna kun je in de editor nog corrigeren voor je opslaat. <em>De PDF wordt
            ook bewaard</em> zodat je 'm later opnieuw kunt openen.
          </li>
          <li>
            <strong>+ Nieuw teamlid</strong> — leeg formulier voor handmatig invullen
            (zonder PDF). Handig voor een snelle stub; je kunt later alsnog een CV
            uploaden via "Vervangen + opnieuw inlezen".
          </li>
          <li>
            <strong>Tags-velden</strong> (Kernskills, Technologieën, Sectoren, Certificaten)
            zijn komma-gescheiden tekstvelden. Bewust simpel zodat je snel kunt typen;
            bij save splitsen we op komma's en bewaren we ze als arrays in de database
            (voor straks-zoeken).
          </li>
          <li>
            <strong>Beschikbaar voor sales</strong> — toggle: Ja/Nee. Niet-beschikbare
            collega's blijven zichtbaar in de lijst (met een grijs label) maar zou Nova
            straks lager rangschikken bij een match.
          </li>
          <li>
            <strong>Projectervaring</strong> — inline-editor met naam + rol + 1–2 zinnen
            beschrijving per project. Wordt door Nova gebruikt als bewijslast bij een pitch
            ("collega X heeft eerder Y gedaan"). Auto-extractie uit CV werkt meestal goed
            voor de top 3–8 projecten; controleer wel.
          </li>
          <li>
            <strong>Klantgerichte samenvatting</strong> — 2–3 zinnen die sales kan kopiëren
            naar offertes/voorstellen. Anders dan de interne CV-samenvatting; bewust
            commercieel verwoord.
          </li>
        </ul>
        <p>
          <strong>Privacy</strong>: zorg dat de CV's al AVG-proof zijn vóór upload — geen
          BSN, geboortedatum, NAW-gegevens of andere gevoelige info die niet nodig is voor
          sales-matching. De PDF's komen in een privé-bucket op Supabase Storage, alleen
          zichtbaar voor ingelogde users van deze app.
        </p>
      </section>

      <section className="ins-section">
        <h3>Tips voor beheer</h3>
        <ul>
          <li>
            Gebruik korte, herkenbare namen voor tags — die verschijnen als knoppen tijdens het gesprek.
          </li>
          <li>
            Vul match-redenen per case-tag in: ze maken direct duidelijk waarom een case relevant
            is, en Nova gebruikt ze in haar onderbouwing.
          </li>
          <li>
            Laat coaching-tekst leeg als je geen scherpe tip hebt — dan toont de app géén lege
            helper, in plaats van een nietszeggende.
          </li>
          <li>
            Maak voor grote content-wijzigingen eerst een lokale backup (klap "Backup &amp; herstel"
            open onderaan Beheer → Cases en klik Backup downloaden).
          </li>
        </ul>
      </section>
    </>
  );
}
