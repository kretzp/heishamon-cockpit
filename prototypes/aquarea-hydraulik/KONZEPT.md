# Aquarea Anlagenmodell – Konzept und Entwurf 01

## Zielbild

Ein animiertes, lesendes Funktionsmodell erklärt, wo Wärme entsteht, welchen Weg das Heizwasser nimmt und welche Messwerte dazu gehören. Es ergänzt die Übersicht im HeishaMon Cockpit. Die HTML-Vorschau nutzt ausschließlich lokale Beispieldaten; sie verbindet sich mit keinem Gerät. Direkt `index.html` im Browser öffnen. Es gibt keine zusätzlichen Abhängigkeiten.

## Gestaltung und Interaktion

Die Vorschau lädt die tatsächlichen semantischen Themes aus `web/src/themes.css`: Hell, Dunkel und Nordic. Sie übernimmt Seitenleiste, flache Karten, Fokusmarkierung, Schrift und tabellarische Zahlen. Die Seitenleisteneinträge zeigen nur den vorgesehenen Anwendungskontext.

## Automatische Gehäusezuordnung

Der Entwurf enthält jetzt zehn Gehäusefamilien mit ein oder zwei animierten Lüftern, schmalen/breiten Gehäusen, dunklen K/L/M-Fronten und separaten schematischen Wand- oder All-in-One-Innenmodulen. Verwendet werden alle 91 numerischen HeishaMon-IDs (0–90) plus die lokal bestätigte Signatur aus `HeatPumpModels.cs`. Diese 92 Kennungen enthalten mehrfach dieselbe Modellbezeichnung.

`aquarea-models.js` enthält den lokalen Zuordnungsschnappschuss. `housings.js` löst vollständige Signaturen und numerische IDs auf; Groß-/Kleinschreibung und zusätzliche Leerzeichen in Signaturen werden normalisiert. Bereits aufgelöste vollständige Modellnamen werden ebenfalls akzeptiert. Unbekannte oder ungültige Kennungen zeigen ein ausdrücklich neutrales Ersatzbild; es gibt keine Schätzung anhand einer Leistungszahl.

Die Demoeinstellung „Erkanntes Modell simulieren“ und die Eingabe für `main/Heat_Pump_Model` rufen dieselbe Funktion `applyDetectedModel(identifier)` auf. Sie aktualisiert Gehäuse, Innenmodul, Modellbezeichnung, Inspektor, Explorer und Exportmetadaten. Initial ist ID 52 eingestellt. Für die spätere Snapshot-Anbindung ist dort die empfangene Modellkennung einzuspeisen; der HTML-Entwurf selbst empfängt weiterhin keine Live-Telemetrie. Geräteidentität bleibt auch bei veralteten Messwerten sichtbar.

Beide Lüfter eines Zweilüftergeräts verwenden in der Demo dieselbe simulierte Drehzahl. Das behauptet keine separate Fan-2-Messung. Die Gehäuseanimation verwendet die bestehenden Zustände für Pause, Abtauen, Bereitschaft, Datenalter und reduzierte Bewegung. Der Modellwechsel baut nur die Gerätegrafik neu auf, nicht das restliche Hydraulikschema. Portverbindungen und Innenmodule sind Funktionsdarstellungen, keine Installationszeichnung. H/J-Standard-Splitgeräte teilen eine Formfamilie trotz kleiner Breitenunterschiede.

Außen- und Innengerät verwenden pro Modellpaar jetzt denselben Maßstab. Frontabmessungen der Wandmodule: 500 × 892 mm; H/J-All-in-One: 598 × 1800 mm; K/L/M-All-in-One mit 185-l-Speicher: 599 × 1642 mm. Der M-Turm `WH-ADC0316M9E83` mit 260 l wird mit 599 × 2036 mm dargestellt. J-Standard-Splitgeräte verwenden 875 mm Breite statt der 900 mm der H-Serie. Beide Gehäuse werden zusammen in den verfügbaren Zeichenbereich eingepasst, ohne ihre Seitenverhältnisse zu verzerren. Quellen für die modernen Innenmodule: [K](https://www.aircon.panasonic.eu/NL_nl/product/k-generatie-1-fase-r32/), [L](https://cdn.aircon.panasonic.eu/uploads/AT/Catalogues/2025/25_0185_L_Flyer_6P_2025_RZ_Einzelseiten.pdf), [M 185/260 l](https://cdn.aircon.panasonic.eu/uploads/DE/Catalogues/2025/DE-LFLT_AQU_M2503.pdf).

Eine schematische Durchsicht über der Gerätefront zeigt die vollständigen Vor- und Rücklaufpfade durch das Innenmodul. Die Primärpumpe sitzt auf dem inneren Rücklaufpfad, bei Monoblock bzw. alleinstehendem M-Außengerät im Außengerät. Unbekannte Geräte erhalten keine angenommene Pumpenposition. Bei H/J/K wird zwischen den Geräten eine gestrichelte Kältemittelverbindung dargestellt; bei L/M verbinden Wasserleitungen beide Geräte. Pumpenanimation und Lüfteranimation besitzen getrennte Geschwindigkeiten: Die Pumpe folgt dem Durchfluss und bleibt während der Abtauung aktiv. Die relative Pumpenposition innerhalb des Gehäuses ist symbolisch, keine maßstäbliche Darstellung der internen Rohrmontage.

Die fokussierten Tests in `housings.test.cjs` prüfen Kataloggleichstand zum Backend, jede Signatur und numerische ID einschließlich 0, die wichtigen Gehäuseausnahmen, unbekannte/bösartige Eingaben, Lüfterzahl, Innenmodule, gemeinsame Maßstäbe, Seitenverhältnisse, Pumpenposition innerhalb des zugehörigen Geräts sowie die Integration mit Modellauswahl und Betriebszuständen. Ausführen: `node --test prototypes/aquarea-hydraulik/housings.test.cjs`. JavaScript-Syntax und DOM-Logik wurden geprüft; die visuelle Browserprüfung war durch die lokale Datei-URL-Sperre des Browserwerkzeugs blockiert.

- Vier Leitwerte: thermische Leistung, elektrische Aufnahme, momentanes Verhältnis und Spreizung. Im Kühlfall wird das Verhältnis ausdrücklich als Kälte/Strom erklärt.
- Flusspunkte zeigen den aktiven Pfad; die Flussgeschwindigkeit folgt dem Demo-Durchfluss. Der Lüfter folgt der Demo-Drehzahl. Abtauung stoppt den Lüfter; Bereitschaft und veraltete Daten stoppen die Bewegung. Pause friert Werte und Animation ein. Reduzierte Bewegung des Betriebssystems wird berücksichtigt.
- Bauteiltasten öffnen den Inspektor: Außeneinheit, Hydraulik, Warmwasser, Heizkreise, Kältekreis. Diese Tasten sind die zugängliche Auswahl zum grafischen Schema.
- Der Messwert-Explorer enthält alle expliziten Einträge des aktuellen `Catalog.Metrics` einschließlich der sechs Heizkurvenfelder. Zusätzliche Modellzuordnungen sind als geplant markiert. Suche funktioniert nach Bezeichnung, Schlüssel und Topic. Nicht simulierte Bestandswerte bleiben leer statt erfundene Präzision zu zeigen.
- Konfiguration: simulierte Modellkennung mit automatisch abgeleiteter Bauform, direkter Heizkreis oder Reihenpuffer, ein oder zwei Kreise, Warmwasserspeicher, Leitungstemperaturen, Animation und Tempo. JSON-Export v2 enthält Darstellungseinstellungen und die Demo-Modellzuordnung. Import und Speicherung sind noch nicht umgesetzt.

Das Schema bleibt absichtlich ein Funktionsbild: Split/Hydrobox und All-in-One zeigen ein separates, vereinfachtes Innenmodul neben dem Außengerät. Der vorhandene externe Speicher steht bei All-in-One schematisch für den integrierten Speicher; seine Position bildet keine tatsächliche Installation ab. Ein zweiter Kreis zeigt zunächst eine gemeinsame Versorgung; eigene Mischgruppe und Temperaturregelung fehlen. Der Reihenpuffer ist schematisch eingezeichnet. Ein Installationsplan oder eine hydraulische Berechnung ist damit nicht gegeben.

Gehäusereferenzen: [H-Monoblock](https://cdn.aircon.panasonic.eu/uploads/NO/Catalogues/03%20NO%204P%20AQ%20Monoblock%2019_1.4.pdf), [H-Split / Super Quiet](https://www.panasonicproclub.com/uploads/IE/catalogues/PIR%20A2W%20PRICE%20LIST%2020%20%28V2%29.pdf), [J-Split](https://cdn.aircon.panasonic.eu/uploads/IE/Catalogues/FINAL%20IE-A2WPLST0523-01%20CTA.pdf), [K](https://cdn.aircon.panasonic.eu/uploads/BE/Catalogues/K%20generatie%2022042024.pdf), [L](https://cdn.aircon.panasonic.eu/uploads/DE/Catalogues/2024/Flyer_Aquarea%20L-Serie%20Sep.24.pdf), [M](https://cdn.aircon.panasonic.eu/uploads/DE/Catalogues/2025/DE-LFLTAQM2501.pdf). Grundlage ist die Recherche vom 15.11.2026, keine erneute Produktfreigabe oder Prüfung exakter Gitterdetails.

## Aquarea-spezifische Datenregeln für die Integration

Maßgeblich sind `src/Cockpit.Domain/Telemetry.cs`, `HeatingCurve.cs` und die vorhandene COP-Logik in `src/Cockpit.Application/ExtraCop.cs`.

1. Aktuelle Aktivität aus gültigen Zuständen ableiten: Abtauung hat Vorrang, danach Ventilpfad, Verdichter und gewählte Betriebsart auswerten. Primärpumpen-Nachlauf/Zirkulation und Lüfter-Nachlauf unabhängig vom Verdichter darstellen. Widersprüche als unbekannt markieren. Die gewählte Betriebsart allein bedeutet keinen aktiven Heizbetrieb.
2. Temperatur, Durchfluss, Druck und Zustände nur mit gültiger Qualität animieren. `unknown`, `invalid`, `stale`, Retained-Daten und getrennte Quelle ausdrücklich behandeln. Letzten bekannten Wert allenfalls mit Alter zeigen; keine laufende Animation als Zeichen aktueller Daten.
3. Druckeinheiten erhalten: Wasserdruck ist bar, vorhandener Kältemittel-Hochdruck kgf/cm². Umrechnung nur ausdrücklich und nachvollziehbar.
4. Raum- und Zonen-Wassertemperatur anhand des Sensormodus trennen; nicht verfügbare Aquarea-Sentinelwerte unterdrücken. Heizkurvenverschiebung und direkter Sollwert haben unterschiedliche Bedeutung.
5. Heizstabfreigaben nicht als Stromverbrauch oder tatsächlichen Betrieb interpretieren. Leistung aus der dokumentierten aktiven Quelle beziehen, keine doppelte Summierung von S0 und internen Messwerten. Die Vorschau simuliert keinen aktiven Heizstab.
6. COP ist berechnet, kein zusätzlicher Sensor. Vorhandene Qualitäts-, Zeit- und Betriebsgrenzen wiederverwenden. Bei Abtauung, Standby oder unbrauchbaren Eingangswerten kein COP. Ein Kühlleistungsverhältnis benötigt eine eigene Produktbezeichnung und Berechnungsregel.
7. Kältekreis-Sensorrollen im Heizbetrieb nicht unverändert auf Kühlen und Abtauen übertragen. Keine Überhitzung oder Unterkühlung aus ungesicherten Sensorrollen berechnen.

## Vollständigkeit und Verfügbarkeit

„Alle möglichen Messwerte“ bedeutet einen erweiterbaren Katalog, keine Garantie identischer Sensoren auf jeder Aquarea. Das Geräteprofil soll Generation, Modell, Firmware, Zusatzplatine und angeschlossene Fühler berücksichtigen. Sensoren erhalten Schlüssel, Rolle, Einheit, Quelle, Status und Aktualisierungszeit. Unbekannte Zusatzwerte bleiben im Explorer auffindbar, bis ihre Rolle verifiziert ist.

Vorhanden: Temperaturen, Durchfluss, Druck, Verdichter, Primärpumpe, Lüfter, Ströme, Leistung nach Betriebsart, Ventil, Betriebszustände, Fehler, Zähler, Heizkurven und optionale Sterilisations-/Relaiswerte. Dynamische Dallas-Fühler und alternative Strommessung existieren im Produkt; deren Bauteilzuordnung ist separat zu ergänzen. Erweiterungen wie zusätzliche Kältekreissensoren, Zone 2 und Puffersensoren benötigen geprüfte Zuordnungen. Der Explorer ist ein statischer Katalog-Schnappschuss des Entwurfs, keine automatisch aktuelle Produktdokumentation.

## Bezug zur Heat Pump Hydraulic Card

Quellen: [Projekt und Funktionen](https://github.com/Sturmi77/heatpump-hydraulic-card) und [HeishaMon-Preset](https://github.com/Sturmi77/heatpump-hydraulic-card/blob/main/docs/presets/heishamon.md), gelesen am 15.11.2026.

Übernommen wird die Interaktionsidee aus animiertem Fluss, Zustand, optionalen Komponenten und Detailansicht. SVG und Vorschaucode sind eigenständig; keine Einbettung der Home-Assistant-Karte und keine fremden Assets. Eine direkte Abhängigkeit wäre wegen Home-Assistant-Entitymodell und dessen Laufzeit für diesen Entwurf unnötig.

| Referenzoption | Aquarea-Konzept |
| --- | --- |
| Hersteller-Preset / Gerätezeichnung | Ausschließlich Aquarea; Bauform und später verifiziertes Modellprofil |
| Heizkreise und Heizflächen | Maximal zwei Zonen; Fußboden/Heizkörper, später Mischerkonfiguration |
| Speicher und Puffer | Warmwasserspeicher und Reihenpuffer im Entwurf; Parallelpuffer als spätere eigene Topologie |
| Entity-Mapping | Cockpit-Metrikschlüssel mit geprüften Einheiten und Qualität statt HA-Entities |
| Leistung, Energie und Statistik | Vorhandene Leistungsquellen/COP wiederverwenden; historische Summen aus vorhandener Historie |
| Detailansicht / Kältekreis | Inspektor vorhanden; zusätzliche Sensorrollen noch prüfen |
| Layout / Animation / Farben | Responsive Ansicht, drei Cockpit-Themes, Pause, reduzierbare Bewegung |
| Schnelle Gerätesteuerung | Nicht Bestandteil dieses lesenden Modells |

PV, Batterie, weitere Hersteller, sechs Heizkreise oder beliebige Kaskaden sind kein Bestandteil des ersten Aquarea-Modells. Eine spätere elektrische Energieansicht kann vorhandene externe Quellen separat ergänzen.

## Nächster Umsetzungsschnitt

React-Seite in die bestehende Navigation integrieren, das SVG in kleine Bauteile zerlegen und denselben Snapshot wie die Übersicht verwenden. Daten kommen aus `/api/v1/snapshot` und SignalR `/hubs/telemetry` (`SnapshotChanged`), einschließlich vorhandener Instanz-/Revisionsprüfung. Keine zweite MQTT-Verbindung anlegen.

Darstellungsmodell und Zustandsermittlung von SVG-Komponenten trennen. Konfiguration zunächst lokal versionieren und validieren; Sensorzuordnungen und Aquarea-Fähigkeiten explizit halten. Anschließend Modelltopologien und externe Messstellen erweitern. Verifizieren mit vorhandener Simulator-Konfiguration: Pfadwechsel, Abtauen, Lüfter-/Pumpennachlauf, ungültige/veraltete Werte, unbekanntes Modell, Tastaturbedienung und schmale Bildschirme. Keine Gerätesteuerung für die Prüfung starten.


## Heizflächen und Verbindungsanimation

Für jeden aktiven Heizkreis lässt sich Fußbodenheizung oder Heizkörper unabhängig auswählen. Symbol und Beschriftung im Schema sowie der Heizkreis-Inspektor folgen der Auswahl. Bei nur einem Kreis ist die Auswahl für Kreis 2 deaktiviert; der JSON-Export v3 enthält dessen Heizfläche dann als null. Die Heizfläche ändert nur die Darstellung, keine Regelung, Heizkurve oder Solltemperatur.

Zwischen H/J/K-Außen- und Innengerät laufen jetzt zwei getrennte animierte Kältemittelpfade über der gestrichelten Grundlinie. Beim Kühlen und Abtauen kehrt nur deren Animation die Richtung um. Bei L/M werden die Wasserverbindungen bereits durch die durchgängigen animierten Vor-/Rücklaufpfade dargestellt; deren Richtung bleibt erhalten. Pause, fehlende Aktualität, Bereitschaft und reduzierte Bewegung gelten auch für die neuen Pfade. Sieben fokussierte Tests bestanden, einschließlich Heizflächenwechsel und beider Kältemittelleitungen. Browserlayout weiterhin nicht visuell geprüft.
