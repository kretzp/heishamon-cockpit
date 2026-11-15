# Anlagenmodell

„Anlagenmodell“ ist die erste Ansicht und der Startreiter. Die bisherige Übersicht bleibt direkt danach erreichbar.

Das Schema verwendet denselben Telemetrie-Snapshot und dieselbe SignalR-Verbindung wie die anderen Ansichten. Es öffnet keine zusätzliche MQTT-Verbindung und sendet keine Gerätesollwerte. Die automatische Gehäuseauswahl richtet sich nach dem erkannten Aquarea-Modell. Bekannte IDs und Signaturen werden exakt zugeordnet; unbekannte Modelle erhalten eine neutrale Darstellung ohne angenommene Pumpenposition.

## Konfiguration pro Installation

Administratoren öffnen **Modell konfigurieren**. Einstellbar sind ein oder zwei Heizkreise, Fußbodenheizung oder Heizkörper pro Kreis, Warmwasserspeicher, Reihenpuffer, Leitungstemperaturen und Animationen. Änderungen sind vor dem Speichern als Vorschau sichtbar. **Abbrechen** stellt die gespeicherte Darstellung wieder her.

**Speichern** legt die Konfiguration zentral in der bestehenden Einstellungsdatei `<History:Path>.settings.json` unter `PlantModel` ab. Sie gilt für alle Benutzer und Browser dieser Installation und bleibt bei einem Neustart erhalten. Andere geöffnete Anlagenmodell-Ansichten laden die Konfiguration spätestens nach 30 Sekunden erneut. Ein Speicherkonflikt fordert zum Neuladen auf; fremde Änderungen werden nicht automatisch überschrieben.

Nur angemeldete Administratoren können speichern. Leser und Bediener sehen die gemeinsame Konfiguration ohne Bearbeitungsfunktion. Die API erzwingt dieselbe Rollenbeschränkung, den bestehenden CSRF-Schutz und Revisionsprüfung. Im anonymen Simulatorbetrieb ohne aktivierte Authentifizierung ist die Ansicht lesend.

## Messwerte und Bewegung

Pumpenanimation folgt dem gültigen Durchfluss, Lüfteranimation der Lüfterdrehzahl und die Kältemittelanimation der Verdichterfrequenz. Die aktuelle Aktivität wird aus Verdichter, Ventilstellung, Abtauung und gewählter Betriebsart abgeleitet. Eine gewählte Betriebsart allein gilt nicht als laufender Heizbetrieb. Nachlauf/Zirkulation können unabhängig vom Verdichter sichtbar bleiben.

Ungültige, unbekannte, veraltete, historische/retained und bei Verbindungsabbruch nicht aktuelle Messwerte werden nicht als aktuelle Zahlen ausgegeben und treiben keine Animation an. Der COP stammt aus der vorhandenen abgesicherten Backend-Berechnung. Elektrische und thermische Leistung werden für den tatsächlichen aktiven Betriebszweig angezeigt. Es werden keine fehlenden Werte simuliert.

Der Messwert-Explorer zeigt die empfangenen Snapshot-Felder einschließlich optionaler und externer Sensoren, Datenqualität und Empfangsalter. Der Bauteil-Inspektor ordnet die vorhandenen Werte den Komponenten zu. Nicht angebotene Zone-2- oder Kältekreissensoren werden nicht erfunden.

Die Bauteilauswahl steht direkt unter der animierten Grafik. In der Desktopansicht stehen die zugehörigen Messwerte rechts neben der Grafik, auf schmalen Bildschirmen darunter. Lüfter und Pumpenrotor drehen in eigenen lokalen Koordinaten um feste Achsen. Geräteposition und Rotation sind getrennt, damit die Rotoren bei Animation und Live-Aktualisierung nicht aus dem Gehäuse wandern.

Die Desktopgrafik skaliert proportional auf 370 bis 480 Pixel Höhe, während der Anlagenstatus mindestens 320 Pixel Breite erhält. Vergrößerte Beschriftungen und Messwerte erleichtern das Lesen. Die Umschaltknöpfe stehen direkt darunter. Je nach Fenstergröße kann Scrollen erforderlich sein.

## Grenzen der Darstellung

Gehäuse und Innenmodule teilen einen gemeinsamen Maßstab; Rohre und innere Bauteilpositionen bleiben schematisch. H/J/K verwenden zwischen Außen- und Innengerät Kältemittelleitungen; L/M hydraulische Verbindungen. Der Aquarea-Primärpumpenmarker sitzt im Innenmodul oder beim Monoblock/alleinstehenden M-Gerät im Außengerät.

Zwei gezeichnete Lüfter verwenden derzeit dieselbe vorhandene Fan-1-Drehzahl. Heizkreis 2 und ein Reihenpuffer sind optionale Darstellungskomponenten, keine Aussage über zusätzliche verfügbare Sensoren oder Mischerkonfiguration. Die Speicherposition im Schema kann auch den integrierten All-in-One-Speicher repräsentieren. Das Schema ersetzt keinen Installationsplan und keine hydraulische Auslegung.

Die verifizierten Gehäusefamilien und Herstellerquellen sind im [Entwurfskonzept](../prototypes/aquarea-hydraulik/KONZEPT.md) dokumentiert. Der automatisierte Frontend-Test gleicht die bekannten Modellzuordnungen mit dem Backend-Katalog ab.

## Automatisierte Prüfung

Der Katalogtest prüft alle 91 Legacy-IDs und die zusätzliche bestätigte L-Signatur sowie den gemeinsamen Gerätemaßstab. Die Browsermatrix prüft zwölf Gerätevertreter aus allen zehn Gehäusefamilien, darunter ältere und aktuelle All-in-One-Module sowie den hohen M-Speicher. Sie läuft auf Desktop und Mobilgerät und prüft Gehäuseauswahl, Lüfteranzahl, Pumpenposition, feste Rotationsachsen, optionale Heizkreise und fehlenden Seitenüberlauf.

Die Zustandsmatrix umfasst Heizen, Warmwasser, Kühlen, Abtauen, Umwälzung, Bereitschaft und Verbindungsabbruch. Weitere Tests prüfen veraltete und historische Messwerte, unbekannte Modelle, Administratorrechte, CSRF, Speicherung über Neustarts und Revisionskonflikte. Diese Prüfungen verwenden simulierte Messwerte; sie bestätigen keine Ausführung auf der echten Wärmepumpe.
