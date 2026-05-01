// React-hook rondom Web Speech API (browser-native speech-to-text).
//
// Geeft sales een microfoon-knop in de chat zodat ze hands-free vragen
// kunnen stellen of ruwe gespreksnotities kunnen inspreken. Werkt in
// Chrome, Edge en Safari (via webkit-prefix); Firefox heeft geen support
// dus de knop verbergen we daar via `isSupported`.
//
// Patroon:
//   const { isSupported, isListening, transcript, start, stop } = useSpeechRecognition({
//     lang: 'nl-NL',
//     onFinalChunk: (text) => appendToInput(text),
//   });
//
// `transcript` toont de live tekst (interim + final) zodat de UI kan
// laten zien wat 't model nu hoort. `onFinalChunk` callback firet
// alleen voor final-results — die wil je in de chat-input committen.

import { useEffect, useRef, useState } from 'react';

// Browser feature-detection. Chrome/Edge gebruiken de webkit-prefix nog
// steeds; Safari ondersteunt 't via `webkitSpeechRecognition`. We checken
// beide en kiezen wat beschikbaar is.
function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ lang = 'nl-NL', onFinalChunk } = {}) {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  const isSupported = !!SpeechRecognition;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  // Recognition-instance in een ref zodat de callbacks 'm kunnen
  // bereiken zonder als state mee te re-rendere.
  const recognitionRef = useRef(null);
  // onFinalChunk in een ref zodat we niet bij elke parent-render
  // de recognition opnieuw hoeven te wiren.
  const onFinalChunkRef = useRef(onFinalChunk);
  useEffect(() => { onFinalChunkRef.current = onFinalChunk; }, [onFinalChunk]);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;       // blijf luisteren tot stop()
    recognition.interimResults = true;   // partial-results live tonen

    // Per result-event krijgen we mogelijk meerdere SpeechRecognitionResults
    // — interim én final. We bouwen de complete transcript-string uit ALLE
    // resultaten in de event, maar firen onFinalChunk alleen voor 't NIEUWE
    // final-stuk.
    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          newFinal += text;
        } else {
          interim += text;
        }
      }
      if (newFinal) {
        finalTranscript += newFinal;
        // Trim spaties + commit naar parent zodat 't in de chat-input
        // verschijnt; transcript-state zelf laten we leeg-resetten zodra
        // we nieuwe interim binnenkrijgen (visuele rust).
        const cleaned = newFinal.trim();
        if (cleaned && onFinalChunkRef.current) {
          onFinalChunkRef.current(cleaned);
        }
      }
      // Live preview: interim of laatste-final voor visuele feedback.
      setTranscript(interim || newFinal || '');
    };

    recognition.onerror = (event) => {
      // 'no-speech' is benign (gebruiker zei niets binnen X sec);
      // 'aborted' komt na een handmatige stop. Beide niet als error tonen.
      if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTranscript('');
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionRef.current = recognition;

    return () => {
      // Cleanup bij unmount — voorkomt dat een achtergrond-recognition
      // doorgaat als het component weg is.
      try { recognition.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    };
  }, [SpeechRecognition, lang]);

  const start = () => {
    if (!recognitionRef.current || isListening) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      // start() throws als 't al actief is; UX-side niet kritiek.
      console.warn('[useSpeechRecognition] start fout:', err?.message || err);
    }
  };

  const stop = () => {
    if (!recognitionRef.current || !isListening) return;
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn('[useSpeechRecognition] stop fout:', err?.message || err);
    }
  };

  return { isSupported, isListening, transcript, error, start, stop };
}
