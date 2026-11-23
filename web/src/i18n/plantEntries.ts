export const plantEntries: Record<string, readonly [string,string,string,string,string]> = {
  "Temperaturdaten": ["Temperature data", "Données de température", "Datos de temperatura", "Dati di temperatura", "Dados de temperatura"],
  "Ersetzt nach dem Speichern die Innentemperatur im Anlagenmodell, im Temperaturverlauf und auf der Übersicht. Fehlende MQTT-Werte werden als - angezeigt. Veraltete Temperaturen bleiben sichtbar.": ["After saving, replaces the indoor temperature in the system model, temperature history and overview. Missing MQTT readings display -. Stale temperatures remain visible.", "Après enregistrement, remplace la température intérieure dans le modèle, l’historique et la vue d’ensemble. Les valeurs MQTT absentes affichent -. Les températures périmées restent visibles.", "Tras guardar, sustituye la temperatura interior en el modelo, el historial y el resumen. Las lecturas MQTT ausentes muestran -. Las temperaturas antiguas siguen visibles.", "Dopo il salvataggio sostituisce la temperatura interna nel modello, nello storico e nella panoramica. Le letture MQTT mancanti mostrano -. Le temperature obsolete restano visibili.", "Após guardar, substitui a temperatura interior no modelo, no histórico e na visão geral. Leituras MQTT ausentes mostram -. Temperaturas antigas continuam visíveis."],
  "Bitte eine Stundenzahl zwischen 1 und 24 eingeben.": ["Enter a number of hours between 1 and 24.", "Saisissez un nombre d’heures entre 1 et 24.", "Introduce un número de horas entre 1 y 24.", "Inserisci un numero di ore tra 1 e 24.", "Introduza um número de horas entre 1 e 24."],
  "Tagesverlauf unvollständig ab": ["Daily history incomplete below", "Historique journalier incomplet en dessous de", "Historial diario incompleto por debajo de", "Storico giornaliero incompleto sotto", "Histórico diário incompleto abaixo de"],
  "Abgeschlossene Tage mit weniger gültigen Messstunden gelten als unvollständig. Gilt sofort auch für bereits erfasste Tage.": ["Past days with fewer valid measurement hours are considered incomplete. Applies immediately to previously recorded days too.", "Les jours terminés avec moins d’heures de mesure valides sont incomplets. S’applique immédiatement aux jours déjà enregistrés.", "Los días terminados con menos horas válidas se consideran incompletos. Se aplica inmediatamente también a los días ya registrados.", "I giorni conclusi con meno ore valide sono incompleti. Si applica subito anche ai giorni già registrati.", "Dias concluídos com menos horas válidas são incompletos. Aplica-se imediatamente também aos dias já registados."],
  " · Tage in Europe/Berlin · Abgeschlossene Tage ab {0} h Abdeckung gelten als vollständig.": [" · Days in Europe/Berlin · Past days with at least {0} h coverage are considered complete.", " · Jours en Europe/Berlin · Les jours terminés avec au moins {0} h de couverture sont complets.", " · Días en Europe/Berlin · Los días terminados con al menos {0} h de cobertura se consideran completos.", " · Giorni in Europe/Berlin · I giorni conclusi con almeno {0} h di copertura sono completi.", " · Dias em Europe/Berlin · Dias concluídos com pelo menos {0} h de cobertura são completos."],

  "Haustemperatur per MQTT": ["House temperature via MQTT", "Température de la maison via MQTT", "Temperatura de la casa por MQTT", "Temperatura della casa via MQTT", "Temperatura da casa via MQTT"],
  "MQTT-Haustemperatur verwenden": ["Use MQTT house temperature", "Utiliser la température de la maison MQTT", "Usar temperatura de la casa MQTT", "Usa temperatura della casa MQTT", "Usar temperatura da casa MQTT"],
  "Temperatur in °C über den konfigurierten MQTT-Broker. Payload-Pfad leer: direkte Zahl, sonst z. B. $.temperature. Keine MQTT-Platzhalter.": ["Temperature in °C via the configured MQTT broker. Empty payload path: a direct number; otherwise e.g. $.temperature. No MQTT wildcards.", "Température en °C via le broker MQTT configuré. Chemin vide : nombre direct ; sinon p. ex. $.temperature. Aucun joker MQTT.", "Temperatura en °C mediante el broker MQTT configurado. Ruta vacía: número directo; si no, p. ej. $.temperature. Sin comodines MQTT.", "Temperatura in °C tramite il broker MQTT configurato. Percorso vuoto: numero diretto; altrimenti ad es. $.temperature. Nessun carattere jolly MQTT.", "Temperatura em °C pelo broker MQTT configurado. Caminho vazio: número direto; caso contrário, p. ex. $.temperature. Sem curingas MQTT."],
  "Ersetzt nach dem Speichern die Haustemperatur im Hausbild. Fehlende MQTT-Werte werden als - angezeigt. Veraltete Temperaturen bleiben sichtbar.": ["After saving, replaces the house temperature in the diagram. Missing MQTT readings display -. Stale temperatures remain visible.", "Après enregistrement, remplace la température de la maison dans le schéma. Les valeurs MQTT absentes affichent -. Les températures périmées restent visibles.", "Tras guardar, sustituye la temperatura de la casa en el diagrama. Las lecturas MQTT ausentes muestran -. Las temperaturas antiguas siguen visibles.", "Dopo il salvataggio sostituisce la temperatura della casa nel diagramma. Le letture MQTT mancanti mostrano -. Le temperature obsolete restano visibili.", "Após guardar, substitui a temperatura da casa no diagrama. Leituras MQTT ausentes mostram -. Temperaturas antigas continuam visíveis."],

  "Anlagenmodell · Messwertdetails": [
    "System model · Reading details",
    "Modèle de l'installation · Détails de mesure",
    "Modelo de la instalación · Detalles de medición",
    "Modello impianto · Dettagli della misura",
    "Modelo da instalação · Detalhes da medição"
  ],
  "Für die Modellkennung gibt es keinen Messwertverlauf.": [
    "There is no reading history for the model identifier.",
    "L'identifiant du modèle n'a pas d'historique de mesure.",
    "El identificador del modelo no tiene historial de mediciones.",
    "L'identificativo del modello non ha uno storico delle misure.",
    "O identificador do modelo não tem histórico de medições."
  ],
  "Anlagenmodell": [
    "System model",
    "Modèle de l’installation",
    "Modelo de la instalación",
    "Modello impianto",
    "Modelo da instalação"
  ],
  "Automatische Modellerkennung": [
    "Automatic model detection",
    "Détection automatique du modèle",
    "Detección automática del modelo",
    "Rilevamento automatico del modello",
    "Deteção automática do modelo"
  ],
  "Modell unbekannt": [
    "Unknown model",
    "Modèle inconnu",
    "Modelo desconocido",
    "Modello sconosciuto",
    "Modelo desconhecido"
  ],
  "Bereitschaft": [
    "Standby",
    "Veille",
    "En espera",
    "Standby",
    "Espera"
  ],
  "Umwälzung": [
    "Circulation",
    "Circulation",
    "Circulación",
    "Circolazione",
    "Circulação"
  ],
  "Abtauung": [
    "Defrosting",
    "Dégivrage",
    "Desescarche",
    "Sbrinamento",
    "Descongelação"
  ],
  "Animation pausieren": [
    "Pause animation",
    "Mettre l’animation en pause",
    "Pausar animación",
    "Pausa animazione",
    "Pausar animação"
  ],
  "Animation fortsetzen": [
    "Resume animation",
    "Reprendre l’animation",
    "Reanudar animación",
    "Riprendi animazione",
    "Retomar animação"
  ],
  "Modell konfigurieren": [
    "Configure model",
    "Configurer le modèle",
    "Configurar modelo",
    "Configura modello",
    "Configurar modelo"
  ],
  "Die Anlagenmodell-Konfiguration wird pro Installation gespeichert. Nur Administratoren können sie bearbeiten.": [
    "The system model configuration is saved per installation. Only administrators can edit it.",
    "La configuration du modèle est enregistrée par installation. Seuls les administrateurs peuvent la modifier.",
    "La configuración se guarda por instalación. Solo los administradores pueden editarla.",
    "La configurazione è salvata per impianto. Solo gli amministratori possono modificarla.",
    "A configuração é guardada por instalação. Só os administradores a podem editar."
  ],
  "Anlagenmodell-Konfiguration konnte nicht geladen werden.": [
    "Could not load the system model configuration.",
    "Impossible de charger la configuration du modèle.",
    "No se pudo cargar la configuración del modelo.",
    "Impossibile caricare la configurazione del modello.",
    "Não foi possível carregar a configuração do modelo."
  ],
  "Anlagenmodell-Konfiguration gespeichert.": [
    "System model configuration saved.",
    "Configuration du modèle enregistrée.",
    "Configuración del modelo guardada.",
    "Configurazione del modello salvata.",
    "Configuração do modelo guardada."
  ],
  "Diese Einstellungen ändern nur die Darstellung, keine Gerätesollwerte.": [
    "These settings change only the display, not device setpoints.",
    "Ces paramètres modifient uniquement l’affichage, pas les consignes de l’appareil.",
    "Estos ajustes solo cambian la visualización, no las consignas del equipo.",
    "Queste impostazioni modificano solo la visualizzazione, non i setpoint del dispositivo.",
    "Estas definições alteram apenas a visualização, não os valores de referência do equipamento."
  ],
  "Heizkreise": [
    "Heating circuits",
    "Circuits de chauffage",
    "Circuitos de calefacción",
    "Circuiti di riscaldamento",
    "Circuitos de aquecimento"
  ],
  "Heizkreis 1": [
    "Heating circuit 1",
    "Circuit de chauffage 1",
    "Circuito de calefacción 1",
    "Circuito di riscaldamento 1",
    "Circuito de aquecimento 1"
  ],
  "Heizkreis 2": [
    "Heating circuit 2",
    "Circuit de chauffage 2",
    "Circuito de calefacción 2",
    "Circuito di riscaldamento 2",
    "Circuito de aquecimento 2"
  ],
  "Fußbodenheizung": [
    "Underfloor heating",
    "Plancher chauffant",
    "Suelo radiante",
    "Riscaldamento a pavimento",
    "Piso radiante"
  ],
  "Heizkörper": [
    "Radiators",
    "Radiateurs",
    "Radiadores",
    "Radiatori",
    "Radiadores"
  ],
  "Warmwasserspeicher anzeigen": [
    "Show hot water tank",
    "Afficher le ballon ECS",
    "Mostrar depósito de ACS",
    "Mostra accumulo ACS",
    "Mostrar depósito de AQS"
  ],
  "Reihenpuffer anzeigen": [
    "Show series buffer",
    "Afficher le ballon tampon en série",
    "Mostrar depósito de inercia en serie",
    "Mostra accumulo in serie",
    "Mostrar depósito de inércia em série"
  ],
  "Temperaturen an den Leitungen": [
    "Pipe temperatures",
    "Températures des conduites",
    "Temperaturas de tuberías",
    "Temperature delle tubazioni",
    "Temperaturas das tubagens"
  ],
  "Animation anzeigen": [
    "Show animation",
    "Afficher l’animation",
    "Mostrar animación",
    "Mostra animazione",
    "Mostrar animação"
  ],
  "Animationstempo": [
    "Animation speed",
    "Vitesse de l’animation",
    "Velocidad de animación",
    "Velocità animazione",
    "Velocidade da animação"
  ],
  "Leistungsübersicht": [
    "Power overview",
    "Aperçu des puissances",
    "Resumen de potencia",
    "Panoramica potenze",
    "Resumo de potência"
  ],
  "Kälteleistung": [
    "Cooling output",
    "Puissance frigorifique",
    "Potencia frigorífica",
    "Potenza frigorifera",
    "Potência de arrefecimento"
  ],
  "Thermische Leistung": [
    "Thermal output",
    "Puissance thermique",
    "Potencia térmica",
    "Potenza termica",
    "Potência térmica"
  ],
  "Elektrische Leistung": [
    "Electrical input",
    "Puissance électrique",
    "Potencia eléctrica",
    "Potenza elettrica",
    "Potência elétrica"
  ],
  "Hydraulik & Energiefluss": [
    "Hydraulics & energy flow",
    "Hydraulique et flux d’énergie",
    "Hidráulica y flujo de energía",
    "Idraulica e flusso energetico",
    "Hidráulica e fluxo de energia"
  ],
  "Außeneinheit": [
    "Outdoor unit",
    "Unité extérieure",
    "Unidad exterior",
    "Unità esterna",
    "Unidade exterior"
  ],
  "Hydraulik": [
    "Hydraulics",
    "Hydraulique",
    "Hidráulica",
    "Idraulica",
    "Hidráulica"
  ],
  "Kältekreis": [
    "Refrigerant circuit",
    "Circuit frigorifique",
    "Circuito frigorífico",
    "Circuito frigorifero",
    "Circuito frigorífico"
  ],
  "Gemeinsamer Gerätemaßstab. Leitungsführung und Bauteilpositionen sind schematisch.": [
    "Units share a common scale. Pipes and component positions are schematic.",
    "Les unités partagent la même échelle. Conduites et composants sont schématiques.",
    "Las unidades comparten escala. Tuberías y componentes son esquemáticos.",
    "Le unità condividono la stessa scala. Tubazioni e componenti sono schematici.",
    "As unidades usam a mesma escala. Tubagens e componentes são esquemáticos."
  ],
  "Gestrichelte Verbindung: Kältemittel (H/J/K).": [
    "Dashed connection: refrigerant (H/J/K).",
    "Liaison en pointillés : fluide frigorigène (H/J/K).",
    "Conexión discontinua: refrigerante (H/J/K).",
    "Collegamento tratteggiato: refrigerante (H/J/K).",
    "Ligação tracejada: refrigerante (H/J/K)."
  ],
  "Es werden nur verfügbare Messwerte angezeigt.": [
    "Only available measurements are shown.",
    "Seules les mesures disponibles sont affichées.",
    "Solo se muestran las medidas disponibles.",
    "Sono mostrate solo le misure disponibili.",
    "São mostradas apenas as medições disponíveis."
  ],
  "Ungültige, veraltete oder historische Werte treiben keine Animation an.": [
    "Invalid, stale or historical readings do not drive animation.",
    "Les valeurs invalides, périmées ou historiques n’animent pas le schéma.",
    "Los valores inválidos, antiguos o históricos no activan la animación.",
    "I valori non validi, obsoleti o storici non attivano l’animazione.",
    "Valores inválidos, antigos ou históricos não ativam a animação."
  ],
  "Messwert-Explorer": [
    "Measurement explorer",
    "Explorateur de mesures",
    "Explorador de medidas",
    "Esplora misure",
    "Explorador de medições"
  ],
  "Messwerte suchen": [
    "Search measurements",
    "Rechercher des mesures",
    "Buscar medidas",
    "Cerca misure",
    "Pesquisar medições"
  ],
  "vor {0} s": [
    "{0} s ago",
    "il y a {0} s",
    "hace {0} s",
    "{0} s fa",
    "há {0} s"
  ],
  "AUSSEN- / INNENGERÄT": [
    "OUTDOOR / INDOOR UNIT",
    "UNITÉ EXTÉRIEURE / INTÉRIEURE",
    "UNIDAD EXTERIOR / INTERIOR",
    "UNITÀ ESTERNA / INTERNA",
    "UNIDADE EXTERIOR / INTERIOR"
  ],
  "HYDRAULIK": [
    "HYDRAULICS",
    "HYDRAULIQUE",
    "HIDRÁULICA",
    "IDRAULICA",
    "HIDRÁULICA"
  ],
  "DEIN ZUHAUSE": [
    "YOUR HOME",
    "VOTRE MAISON",
    "TU HOGAR",
    "LA TUA CASA",
    "A TUA CASA"
  ],
  "Außenluft": [
    "Outdoor air",
    "Air extérieur",
    "Aire exterior",
    "Aria esterna",
    "Ar exterior"
  ],
  "VORLAUF": [
    "FLOW",
    "DÉPART",
    "IMPULSIÓN",
    "MANDATA",
    "IDA"
  ],
  "RÜCKLAUF": [
    "RETURN",
    "RETOUR",
    "RETORNO",
    "RITORNO",
    "RETORNO"
  ],
  "3-WEGE-VENTIL": [
    "3-WAY VALVE",
    "VANNE 3 VOIES",
    "VÁLVULA DE 3 VÍAS",
    "VALVOLA A 3 VIE",
    "VÁLVULA DE 3 VIAS"
  ],
  "REIHENPUFFER": [
    "SERIES BUFFER",
    "TAMPON EN SÉRIE",
    "INERCIA EN SERIE",
    "ACCUMULO IN SERIE",
    "INÉRCIA EM SÉRIE"
  ],
  "WARMWASSER": [
    "HOT WATER",
    "EAU CHAUDE",
    "AGUA CALIENTE",
    "ACQUA CALDA",
    "ÁGUA QUENTE"
  ],
  "Monoblock": [
    "Monobloc",
    "Monobloc",
    "Monobloc",
    "Monoblocco",
    "Monobloco"
  ],
  "Split-System": [
    "Split system",
    "Système split",
    "Sistema split",
    "Sistema split",
    "Sistema split"
  ],
  "All-in-One": [
    "All-in-One",
    "Tout-en-un",
    "Todo en uno",
    "All-in-One",
    "Tudo em um"
  ]
};
