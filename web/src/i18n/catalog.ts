// German source keys with English, French, Spanish, Italian and Portuguese UI translations.
// Technical identifiers, user-entered text and persisted audit messages are not translated.
export const catalog: Record<string, readonly [string, string, string, string, string]> = {
  "Sichtbare Sensoren": ["Visible sensors", "Sondes visibles", "Sensores visibles", "Sensori visibili", "Sensores visíveis"],
  "Dallas-Sensor": ["Dallas sensor", "Sonde Dallas", "Sensor Dallas", "Sensore Dallas", "Sensor Dallas"],
  "Sensoradresse": ["Sensor address", "Adresse de la sonde", "Dirección del sensor", "Indirizzo del sensore", "Endereço do sensor"],
  "Dallas-1-Wire · Messwertdetails": ["Dallas-1-Wire · Reading details", "Dallas-1-Wire · Détails de mesure", "Dallas-1-Wire · Detalles de medición", "Dallas-1-Wire · Dettagli della misura", "Dallas-1-Wire · Detalhes da medição"],
  "Tiefste Außentemperatur · °C": ["Lowest outdoor temperature · °C", "Température extérieure minimale · °C", "Temperatura exterior mínima · °C", "Temperatura esterna minima · °C", "Temperatura exterior mínima · °C"],
  "CSV: ausgewähltes Kalenderjahr mit Tagesverbrauch und tiefster gemessener Außentemperatur (°C). Fehlende Werte bleiben leer; Temperaturminimum nur aus vorhandenen gültigen Messungen, keine vollständige Tagesabdeckung zugesichert.": ["CSV: selected calendar year with daily consumption and lowest measured outdoor temperature (°C). Missing values remain empty; the minimum uses available valid measurements and does not guarantee full-day coverage.","CSV : année sélectionnée, consommation quotidienne et température extérieure minimale mesurée (°C). Valeurs manquantes vides ; minimum des mesures valides disponibles, sans garantie de couverture complète.","CSV: año seleccionado con consumo diario y temperatura exterior mínima medida (°C). Los valores ausentes quedan vacíos; mínimo de mediciones válidas disponibles, sin garantía de cobertura completa.","CSV: anno selezionato con consumo giornaliero e temperatura esterna minima misurata (°C). Valori mancanti vuoti; minimo delle misure valide disponibili, senza garanzia di copertura completa.","CSV: ano selecionado com consumo diário e temperatura exterior mínima medida (°C). Valores em falta ficam vazios; mínimo das medições válidas disponíveis, sem garantia de cobertura completa."],
  "Diagrammhöhe": ["Chart height", "Hauteur du graphique", "Altura del gráfico", "Altezza del grafico", "Altura do gráfico"],
  "Kalenderhöhe": ["Calendar height", "Hauteur du calendrier", "Altura del calendario", "Altezza del calendario", "Altura do calendário"],
  "Kalender aktualisieren": ["Refresh calendar", "Actualiser le calendrier", "Actualizar calendario", "Aggiorna calendario", "Atualizar calendário"],
  "Tagesverbrauch": ["Daily consumption", "Consommation quotidienne", "Consumo diario", "Consumo giornaliero", "Consumo diário"],
  "Hochdruck in kgf/cm²; keine Umrechnung in bar.": ["High pressure in kgf/cm²; no conversion to bar.", "Haute pression en kgf/cm² ; aucune conversion en bar.", "Alta presión en kgf/cm²; sin conversión a bar.", "Alta pressione in kgf/cm²; nessuna conversione in bar.", "Alta pressão em kgf/cm²; sem conversão para bar."],
  "COP-Verlauf": ["COP history", "Historique COP", "Historial COP", "Storico COP", "Histórico COP"],
  "COP · HeishaMon": ["COP · HeishaMon", "COP · HeishaMon", "COP · HeishaMon", "COP · HeishaMon", "COP · HeishaMon"],
  "Aus HeishaMon-Extra-Leistung berechnet": ["Calculated from HeishaMon Extra power", "Calculé à partir des puissances Extra HeishaMon", "Calculado a partir de la potencia Extra de HeishaMon", "Calcolato dalla potenza Extra HeishaMon", "Calculado a partir da potência Extra HeishaMon"],
  "Sterilisation – maximale Dauer nur in 5-Minuten-Schritten.": ["Sterilization – maximum duration only in 5-minute increments.", "Stérilisation – durée maximale uniquement par pas de 5 minutes.", "Esterilización – duración máxima solo en pasos de 5 minutos.", "Sterilizzazione – durata massima solo a intervalli di 5 minuti.", "Esterilização – duração máxima apenas em intervalos de 5 minutos."],
  "Haltezeit nach Erreichen der Zieltemperatur: 5–60 Minuten in 5-Minuten-Schritten.": ["Holding time after reaching the target temperature: 5–60 minutes in 5-minute increments.", "Durée de maintien après atteinte de la température cible : 5–60 minutes par pas de 5 minutes.", "Tiempo de mantenimiento tras alcanzar la temperatura objetivo: 5–60 minutos en pasos de 5 minutos.", "Tempo di mantenimento dopo il raggiungimento della temperatura obiettivo: 5–60 minuti a intervalli di 5 minuti.", "Tempo de manutenção após atingir a temperatura alvo: 5–60 minutos em intervalos de 5 minutos."],
  "Experimentell: Schreibannahme der L-Serie am Bedienteil prüfen.": ["Experimental: verify L-series write acceptance at the controller.", "Expérimental : vérifier la prise en compte sur le panneau de la série L.", "Experimental: compruebe la aceptación de escritura de la serie L en el panel.", "Sperimentale: verificare sul pannello l’accettazione della scrittura della serie L.", "Experimental: verificar no painel de controlo a aceitação da escrita na série L."],
  "Haltezeit nach Erreichen der Zieltemperatur: 5–60 Minuten.": ["Holding time after reaching the target temperature: 5–60 minutes.", "Durée de maintien après atteinte de la température cible : 5–60 minutes.", "Tiempo de mantenimiento tras alcanzar la temperatura objetivo: 5–60 minutos.", "Tempo di mantenimento dopo il raggiungimento della temperatura obiettivo: 5–60 minuti.", "Tempo de manutenção após atingir a temperatura alvo: 5–60 minutos."],
  "Temperatur, maximale Dauer und einmaligen Start unten in der Anlagensteuerung wählen. SET49/SET50 sind experimentell. „Aktiv“ bestätigt keinen abgeschlossenen Zyklus.": ["Select temperature, maximum duration and one-time start in the controls below. SET49/SET50 are experimental. “Active” does not confirm a completed cycle.", "Choisir la température, la durée maximale et le démarrage unique dans les commandes ci-dessous. SET49/SET50 sont expérimentaux. « Actif » ne confirme pas un cycle terminé.", "Seleccione temperatura, duración máxima e inicio único en los controles inferiores. SET49/SET50 son experimentales. «Activo» no confirma un ciclo completado.", "Selezionare temperatura, durata massima e avvio singolo nei comandi sottostanti. SET49/SET50 sono sperimentali. «Attivo» non conferma un ciclo completato.", "Selecionar a temperatura, a duração máxima e o início único nos comandos da instalação abaixo. SET49/SET50 são experimentais. «Ativo» não confirma a conclusão de um ciclo."],
  "Einmaliger Start mit den aktuell eingestellten Werten. Dabei wird das Warmwasser stark erhitzt. Keine automatische Wiederholung; Aktivstatus ist kein Nachweis eines abgeschlossenen Zyklus.": ["One-time start using the current settings. This heats the hot water to a high temperature. No automatic retry; active status does not prove a completed cycle.", "Démarrage unique avec les réglages actuels. L’eau chaude est fortement chauffée. Aucune répétition automatique ; le statut actif ne prouve pas un cycle terminé.", "Inicio único con los ajustes actuales. El agua se calienta a alta temperatura. Sin repetición automática; el estado activo no demuestra un ciclo completado.", "Avvio singolo con le impostazioni attuali. L’acqua viene riscaldata a temperatura elevata. Nessuna ripetizione automatica; lo stato attivo non dimostra un ciclo completato.", "Início único com os valores atualmente definidos. A água quente é aquecida a uma temperatura elevada. Sem repetição automática; o estado ativo não comprova a conclusão de um ciclo."],

  "Geglättete Trendkurve (Fit)": ["Smoothed trend curve (fit)", "Courbe de tendance lissée (ajustement)", "Curva de tendencia suavizada (ajuste)", "Curva di tendenza smussata (fit)", "Curva de tendência suavizada (ajuste)"],
  "{0} · Trend (berechnet)": ["{0} · Trend (calculated)", "{0} · Tendance (calculée)", "{0} · Tendencia (calculada)", "{0} · Tendenza (calcolata)", "{0} · Tendência (calculada)"],
  "Gepunktet: berechneter Trend aus bis zu 11 benachbarten Werten. Mindestens 3 zusammenhängende gültige Werte; Datenlücken bleiben leer. Messwerte, Tabellen und CSV bleiben unverändert.": [
    "Dotted: calculated trend using up to 11 neighbouring values. At least 3 consecutive valid values are required; data gaps remain empty. Readings, tables and CSV are unchanged.",
    "Pointillés : tendance calculée à partir de 11 valeurs voisines au maximum. Au moins 3 valeurs valides consécutives sont nécessaires ; les lacunes restent vides. Mesures, tableaux et CSV inchangés.",
    "Punteada: tendencia calculada con hasta 11 valores vecinos. Se requieren al menos 3 valores válidos consecutivos; los huecos permanecen vacíos. Las mediciones, tablas y CSV no cambian.",
    "Punteggiata: tendenza calcolata usando fino a 11 valori vicini. Sono necessari almeno 3 valori validi consecutivi; le lacune restano vuote. Misure, tabelle e CSV rimangono invariati.",
    "Pontilhado: tendência calculada a partir de até 11 valores vizinhos. São necessários pelo menos 3 valores válidos consecutivos; as lacunas permanecem vazias. Medições, tabelas e CSV permanecem inalterados."
  ],
  " · vor {0} s": [
    " · {0} s ago",
    " · il y a {0} s",
    " · hace {0} s",
    " · {0} s fa",
    " · há {0} s"
  ],
  "{0} · vor {1} s": [
    "{0} · {1} s ago",
    "{0} · il y a {1} s",
    "{0} · hace {1} s",
    "{0} · {1} s fa",
    "{0} · há {1} s"
  ],
  "Anmeldedienst nicht erreichbar. Bitte erneut versuchen.": [
    "Login service unavailable. Please try again.",
    "Service de connexion indisponible. Réessayez.",
    "Servicio de acceso no disponible. Inténtalo de nuevo.",
    "Servizio di accesso non raggiungibile. Riprova.",
    "Serviço de autenticação indisponível. Tente novamente."
  ],
  "Benutzername oder Passwort ist falsch.": [
    "Incorrect username or password.",
    "Nom d’utilisateur ou mot de passe incorrect.",
    "Usuario o contraseña incorrectos.",
    "Nome utente o password errati.",
    "Nome de utilizador ou palavra-passe incorretos."
  ],
  "Zu viele Anmeldeversuche. Bitte eine Minute warten.": [
    "Too many login attempts. Please wait one minute.",
    "Trop de tentatives de connexion. Patientez une minute.",
    "Demasiados intentos de acceso. Espera un minuto.",
    "Troppi tentativi di accesso. Attendi un minuto.",
    "Demasiadas tentativas de início de sessão. Aguarde um minuto."
  ],
  "Anmeldung konnte nicht verarbeitet werden. Bitte erneut versuchen.": [
    "Unable to process login. Please try again.",
    "Impossible de traiter la connexion. Réessayez.",
    "No se pudo procesar el acceso. Inténtalo de nuevo.",
    "Impossibile elaborare l’accesso. Riprova.",
    "Não foi possível processar o início de sessão. Tente novamente."
  ],
  "HeishaMon Cockpit": ["HeishaMon Cockpit", "HeishaMon Cockpit", "HeishaMon Cockpit", "HeishaMon Cockpit", "HeishaMon Cockpit"],
  "Anmelden": [
    "Sign in",
    "Se connecter",
    "Iniciar sesión",
    "Accedi",
    "Iniciar sessão"
  ],
  "Melde dich an, um deine Anlage zu sehen und zu bedienen.": [
    "Sign in to view and control your system.",
    "Connectez-vous pour consulter et commander votre installation.",
    "Inicia sesión para consultar y controlar tu instalación.",
    "Accedi per visualizzare e gestire il tuo impianto.",
    "Inicie sessão para consultar e controlar a sua instalação."
  ],
  "Benutzername": [
    "Username",
    "Nom d’utilisateur",
    "Usuario",
    "Nome utente",
    "Nome de utilizador"
  ],
  "Passwort": [
    "Password",
    "Mot de passe",
    "Contraseña",
    "Password",
    "Palavra-passe"
  ],
  "Anmeldung läuft …": [
    "Signing in …",
    "Connexion en cours…",
    "Iniciando sesión…",
    "Accesso in corso …",
    "A iniciar sessão …"
  ],
  "Zugang wird geprüft.": [
    "Checking access.",
    "Vérification de l’accès.",
    "Comprobando el acceso.",
    "Verifica dell’accesso in corso.",
    "A verificar o acesso."
  ],
  "Erneut versuchen": [
    "Try again",
    "Réessayer",
    "Reintentar",
    "Riprova",
    "Tentar novamente"
  ],
  "Benutzerkonto": [
    "User account",
    "Compte utilisateur",
    "Cuenta de usuario",
    "Account utente",
    "Conta de utilizador"
  ],
  "Angemeldet:": [
    "Signed in:",
    "Connecté :",
    "Sesión iniciada:",
    "Accesso effettuato:",
    "Sessão iniciada:"
  ],
  "Bediener": [
    "Operator",
    "Opérateur",
    "Operador",
    "Operatore",
    "Operador"
  ],
  "Betrachter": [
    "Viewer",
    "Observateur",
    "Observador",
    "Osservatore",
    "Observador"
  ],
  "Abmelden": [
    "Sign out",
    "Se déconnecter",
    "Cerrar sesión",
    "Esci",
    "Terminar sessão"
  ],
  "Heizkurve": [
    "Heating curve",
    "Courbe de chauffe",
    "Curva de calefacción",
    "Curva climatica",
    "Curva de aquecimento"
  ],
  "Heiz-ΔT": [
    "Heating ΔT",
    "ΔT chauffage",
    "ΔT calefacción",
    "ΔT riscaldamento",
    "ΔT de aquecimento"
  ],
  "Heizgrenze": [
    "Heating cutoff",
    "Seuil d’arrêt du chauffage",
    "Límite de calefacción",
    "Limite di riscaldamento",
    "Limite de aquecimento"
  ],
  "Bestätigung ausstehend": [
    "Awaiting confirmation",
    "Confirmation en attente",
    "Pendiente de confirmación",
    "In attesa di conferma",
    "Confirmação pendente"
  ],
  "Übernahme läuft": [
    "Applying changes",
    "Application en cours",
    "Aplicando cambios",
    "Applicazione in corso",
    "Aplicação em curso"
  ],
  "Übereinstimmende Anlagenwerte beobachtet": [
    "Matching system values observed",
    "Valeurs concordantes observées sur l’installation",
    "Valores coincidentes observados en la instalación",
    "Osservati valori corrispondenti dell’impianto",
    "Observados valores coincidentes na instalação"
  ],
  "Teilweise übernommen": [
    "Partially applied",
    "Application partielle",
    "Aplicado parcialmente",
    "Applicato parzialmente",
    "Parcialmente aplicado"
  ],
  "Zeitüberschreitung": [
    "Timed out",
    "Délai dépassé",
    "Tiempo de espera agotado",
    "Tempo scaduto",
    "Tempo limite excedido"
  ],
  "Fehlgeschlagen": [
    "Failed",
    "Échec",
    "Error",
    "Non riuscito",
    "Falhou"
  ],
  "Abgebrochen": [
    "Cancelled",
    "Annulé",
    "Cancelado",
    "Annullato",
    "Cancelado"
  ],
  "Noch nicht gesendet": [
    "Not sent yet",
    "Pas encore envoyé",
    "Todavía no enviado",
    "Non ancora inviato",
    "Ainda não enviado"
  ],
  "Sendeversuch läuft": [
    "Send attempt in progress",
    "Tentative d’envoi en cours",
    "Intento de envío en curso",
    "Tentativo di invio in corso",
    "Tentativa de envio em curso"
  ],
  "Warte auf Rücklesen": [
    "Waiting for readback",
    "En attente de relecture",
    "Esperando lectura de retorno",
    "In attesa di rilettura",
    "A aguardar leitura de retorno"
  ],
  "Nicht gesendet": [
    "Not sent",
    "Non envoyé",
    "No enviado",
    "Non inviato",
    "Não enviado"
  ],
  "Lesender Betrieb · Vorschau ist möglich.": [
    "Read-only operation · Preview is available.",
    "Lecture seule · Aperçu disponible.",
    "Modo de solo lectura · Vista previa disponible.",
    "Sola lettura · Anteprima disponibile.",
    "Modo de leitura · Pré-visualização disponível."
  ],
  "Verbindung zur Anlage oder zum Sender fehlt.": [
    "No connection to the system or transmitter.",
    "Aucune connexion à l’installation ou à l’émetteur.",
    "Sin conexión con la instalación o el transmisor.",
    "Manca la connessione all’impianto o al trasmettitore.",
    "Sem ligação à instalação ou ao emissor."
  ],
  "Aktuelle, vollständige und nicht-retained Anlagenwerte erforderlich.": [
    "Current, complete system values without the retained flag are required.",
    "Des valeurs actuelles, complètes et non retained sont requises.",
    "Se requieren valores actuales y completos sin la marca retained.",
    "Sono necessari valori dell’impianto aggiornati, completi e non retained.",
    "São necessários valores atuais e completos da instalação, não provenientes de mensagens retidas."
  ],
  "Die Anlage verwendet keine witterungsgeführte Heizregelung.": [
    "The system is not using weather-compensated heating control.",
    "L’installation n’utilise pas de régulation du chauffage selon la température extérieure.",
    "La instalación no utiliza regulación de calefacción según la temperatura exterior.",
    "L’impianto non utilizza la regolazione climatica del riscaldamento.",
    "A instalação não utiliza regulação do aquecimento em função da temperatura exterior."
  ],
  "Zone 1 ist nicht aktiv.": [
    "Zone 1 is not active.",
    "La zone 1 n’est pas active.",
    "La zona 1 no está activa.",
    "La zona 1 non è attiva.",
    "A zona 1 não está ativa."
  ],
  "Die aktuelle Betriebsart enthält keinen Heizbetrieb.": [
    "The current operating mode does not include heating.",
    "Le mode actuel ne comprend pas le chauffage.",
    "El modo actual no incluye calefacción.",
    "La modalità attuale non comprende il riscaldamento.",
    "O modo de funcionamento atual não inclui aquecimento."
  ],
  "Der Fehlerstatus der Anlage erlaubt keine Übernahme.": [
    "The system fault status prevents applying changes.",
    "L’état de défaut de l’installation empêche l’application.",
    "El estado de fallo de la instalación impide aplicar cambios.",
    "Lo stato di errore dell’impianto impedisce l’applicazione.",
    "O estado de erro da instalação impede a aplicação."
  ],
  "Ein Auftrag ist noch offen.": [
    "A request is still pending.",
    "Une demande est encore en cours.",
    "Hay una solicitud pendiente.",
    "Un’operazione è ancora in sospeso.",
    "Existe um pedido pendente."
  ],
  "Anlagenwerte wurden zwischenzeitlich geändert. Bitte neu prüfen.": [
    "System values have changed. Please check again.",
    "Les valeurs de l’installation ont changé. Vérifiez à nouveau.",
    "Los valores de la instalación han cambiado. Compruébalos de nuevo.",
    "I valori dell’impianto sono cambiati nel frattempo. Ripeti la verifica.",
    "Os valores da instalação foram entretanto alterados. Verifique novamente."
  ],
  "Das freigegebene Schreibfenster ist beendet.": [
    "The authorised write window has ended.",
    "La fenêtre d’écriture autorisée est terminée.",
    "Ha finalizado el periodo autorizado de escritura.",
    "La finestra autorizzata per le scritture è terminata.",
    "A janela autorizada para escrita terminou."
  ],
  "Befehlsprotokoll nicht verfügbar. Übernahme gesperrt.": [
    "Command log unavailable. Applying changes is blocked.",
    "Journal des commandes indisponible. Application bloquée.",
    "Registro de órdenes no disponible. Aplicación bloqueada.",
    "Registro dei comandi non disponibile. Applicazione bloccata.",
    "Registo de comandos indisponível. Aplicação bloqueada."
  ],
  "Der Entwurf ist abgelaufen. Bitte erneut prüfen.": [
    "The draft has expired. Please check again.",
    "Le brouillon a expiré. Vérifiez à nouveau.",
    "El borrador ha caducado. Compruébalo de nuevo.",
    "La bozza è scaduta. Ripeti la verifica.",
    "O rascunho expirou. Verifique novamente."
  ],
  "Nach Neustart beendet; nichts erneut gesendet.": [
    "Stopped after restart; nothing was resent.",
    "Arrêté après redémarrage ; aucun renvoi.",
    "Detenido tras el reinicio; no se ha reenviado nada.",
    "Terminato dopo il riavvio; nessun nuovo invio.",
    "Terminado após reinício; nada foi reenviado."
  ],
  "Sendefehler: Eine Wirkung ist nicht ausgeschlossen. Anlagenwerte prüfen.": [
    "Send failure: an effect cannot be ruled out. Check system values.",
    "Échec d’envoi : un effet reste possible. Vérifiez les valeurs de l’installation.",
    "Error de envío: no se puede descartar un efecto. Comprueba los valores de la instalación.",
    "Errore di invio: non si può escludere un effetto sull’impianto. Verifica i valori.",
    "Erro de envio: não se pode excluir um efeito. Verifique os valores da instalação."
  ],
  "Passende Rückmeldung nicht rechtzeitig vollständig empfangen.": [
    "Matching feedback was not fully received in time.",
    "Le retour concordant n’a pas été reçu intégralement à temps.",
    "No se recibió a tiempo toda la información de retorno coincidente.",
    "La risposta corrispondente non è stata ricevuta completamente entro il termine.",
    "A resposta correspondente não foi recebida na íntegra dentro do prazo."
  ],
  "Es gibt keine Änderungen.": [
    "There are no changes.",
    "Aucune modification.",
    "No hay cambios.",
    "Non ci sono modifiche.",
    "Não existem alterações."
  ],
  "Bitte korrigiere die markierten Eingaben.": [
    "Please correct the highlighted entries.",
    "Corrigez les champs signalés.",
    "Corrige los campos señalados.",
    "Correggi i valori evidenziati.",
    "Corrija os campos assinalados."
  ],
  "Bitte vor dem nächsten Auftrag 30 Sekunden warten.": [
    "Please wait 30 seconds before the next request.",
    "Patientez 30 secondes avant la prochaine demande.",
    "Espera 30 segundos antes de la siguiente solicitud.",
    "Attendi 30 secondi prima dell’operazione successiva.",
    "Aguarde 30 segundos antes do próximo pedido."
  ],
  "Nur der Ersteller darf diesen Auftrag bestätigen.": [
    "Only the creator may confirm this request.",
    "Seul l’auteur peut confirmer cette demande.",
    "Solo el autor puede confirmar esta solicitud.",
    "Solo l’autore può confermare questa operazione.",
    "Apenas o autor pode confirmar este pedido."
  ],
  "Sitzungsschutz abgelaufen. Bitte neu anmelden.": [
    "Session protection expired. Please sign in again.",
    "La protection de session a expiré. Reconnectez-vous.",
    "La protección de sesión ha caducado. Inicia sesión de nuevo.",
    "Protezione della sessione scaduta. Accedi di nuovo.",
    "A proteção da sessão expirou. Inicie sessão novamente."
  ],
  "Entwurf verworfen.": [
    "Draft discarded.",
    "Brouillon abandonné.",
    "Borrador descartado.",
    "Bozza scartata.",
    "Rascunho descartado."
  ],
  "Ganze Zahl von {0} bis {1} {2}.": [
    "Whole number from {0} to {1} {2}.",
    "Nombre entier de {0} à {1} {2}.",
    "Número entero entre {0} y {1} {2}.",
    "Numero intero da {0} a {1} {2}.",
    "Número inteiro de {0} a {1} {2}."
  ],
  "Außen hoch muss größer als Außen niedrig sein.": [
    "The high outdoor value must exceed the low outdoor value.",
    "La température extérieure haute doit dépasser la température extérieure basse.",
    "La temperatura exterior alta debe superar la baja.",
    "La temperatura esterna alta deve superare quella bassa.",
    "A temperatura exterior alta deve ser superior à temperatura exterior baixa."
  ],
  "Vorlauf niedrig darf Vorlauf hoch nicht überschreiten.": [
    "The low flow value must not exceed the high flow value.",
    "La température de départ basse ne doit pas dépasser la haute.",
    "La temperatura de impulsión baja no debe superar la alta.",
    "La mandata bassa non può superare la mandata alta.",
    "A temperatura de ida baixa não pode exceder a temperatura de ida alta."
  ],
  "Veraltet": [
    "Stale",
    "Périmé",
    "Desactualizado",
    "Non aggiornato",
    "Desatualizado"
  ],
  "Aktuell": [
    "Current",
    "À jour",
    "Actual",
    "Aggiornato",
    "Atual"
  ],
  "Ungültig": [
    "Invalid",
    "Invalide",
    "No válido",
    "Non valido",
    "Inválido"
  ],
  "Unbekannt": [
    "Unknown",
    "Inconnu",
    "Desconocido",
    "Sconosciuto",
    "Desconhecido"
  ],
  " · Retained": [
    " · Retained",
    " · Retained",
    " · Retained",
    " · Retained",
    " · Mensagem retida"
  ],
  "Zulässig sind ganze Zahlen von ": [
    "Allowed whole numbers from ",
    "Nombres entiers autorisés de ",
    "Se permiten números enteros de ",
    "Sono ammessi numeri interi da ",
    "São permitidos números inteiros de "
  ],
  "Außen niedrig muss kleiner als Außen hoch sein.": [
    "The low outdoor value must be below the high outdoor value.",
    "La température extérieure basse doit être inférieure à la haute.",
    "La temperatura exterior baja debe ser inferior a la alta.",
    "La temperatura esterna bassa deve essere inferiore a quella alta.",
    "A temperatura exterior baixa deve ser inferior à temperatura exterior alta."
  ],
  "Vorlauf hoch muss mindestens so groß wie Vorlauf niedrig sein.": [
    "The high flow value must be at least the low flow value.",
    "La température de départ haute doit être au moins égale à la basse.",
    "La temperatura de impulsión alta debe ser al menos igual a la baja.",
    "La mandata alta deve essere almeno pari alla mandata bassa.",
    "A temperatura de ida alta deve ser pelo menos igual à temperatura de ida baixa."
  ],
  "Nicht übernommen. ": [
    "Not applied. ",
    "Non appliqué. ",
    "No aplicado. ",
    "Non applicato. ",
    "Não aplicado. "
  ],
  " Der bisherige Wert bleibt erhalten.": [
    " The previous value is retained.",
    " La valeur précédente est conservée.",
    " Se conserva el valor anterior.",
    " Il valore precedente viene mantenuto.",
    " O valor anterior é mantido."
  ],
  "Anmeldung erforderlich.": [
    "Sign-in required.",
    "Connexion requise.",
    "Se requiere iniciar sesión.",
    "Accesso richiesto.",
    "É necessário iniciar sessão."
  ],
  "Anmeldung erforderlich oder Sitzung abgelaufen.": [
    "Sign-in required or session expired.",
    "Connexion requise ou session expirée.",
    "Se requiere iniciar sesión o la sesión ha caducado.",
    "Accesso richiesto o sessione scaduta.",
    "É necessário iniciar sessão ou a sessão expirou."
  ],
  "Bedienerrechte erforderlich.": [
    "Operator permissions required.",
    "Droits opérateur requis.",
    "Se requieren permisos de operador.",
    "Sono necessari i permessi di operatore.",
    "São necessárias permissões de operador."
  ],
  "Anfrage fehlgeschlagen. Bitte Anlagenwerte prüfen.": [
    "Request failed. Please check system values.",
    "Échec de la demande. Vérifiez les valeurs de l’installation.",
    "Error en la solicitud. Comprueba los valores de la instalación.",
    "Richiesta non riuscita. Verifica i valori dell’impianto.",
    "O pedido falhou. Verifique os valores da instalação."
  ],
  "Anfrage fehlgeschlagen.": [
    "Request failed.",
    "Échec de la demande.",
    "Error en la solicitud.",
    "Richiesta non riuscita.",
    "O pedido falhou."
  ],
  "· geändert": [
    "· changed",
    "· modifié",
    "· modificado",
    "· modificato",
    "· alterado"
  ],
  "{0} erhöhen": [
    "Increase {0}",
    "Augmenter {0}",
    "Aumentar {0}",
    "Aumenta {0}",
    "Aumentar {0}"
  ],
  "Anlage:": [
    "System:",
    "Installation :",
    "Instalación:",
    "Impianto:",
    "Instalação:"
  ],
  "Heizkurve Zone 1": [
    "Zone 1 heating curve",
    "Courbe de chauffe de la zone 1",
    "Curva de calefacción de la zona 1",
    "Curva climatica zona 1",
    "Curva de aquecimento da zona 1"
  ],
  "Zone 1 · Witterungsgeführt": [
    "Zone 1 · Weather compensation",
    "Zone 1 · Régulation climatique",
    "Zona 1 · Regulación climática",
    "Zona 1 · Regolazione climatica",
    "Zona 1 · Regulação pela temperatura exterior"
  ],
  "Simulierte Heizkurve": [
    "Simulated heating curve",
    "Courbe de chauffe simulée",
    "Curva de calefacción simulada",
    "Curva climatica simulata",
    "Curva de aquecimento simulada"
  ],
  "Anlagenwerte und lokale Vorschau": [
    "System values and local preview",
    "Valeurs de l’installation et aperçu local",
    "Valores de la instalación y vista previa local",
    "Valori dell’impianto e anteprima locale",
    "Valores da instalação e pré-visualização local"
  ],
  "Außen": [
    "Outdoor",
    "Extérieur",
    "Exterior",
    "Esterno",
    "Exterior"
  ],
  "Soll · Anlage (TOP7)": [
    "Setpoint · System (TOP7)",
    "Consigne · Installation (TOP7)",
    "Consigna · Instalación (TOP7)",
    "Setpoint · Impianto (TOP7)",
    "Valor definido · Instalação (TOP7)"
  ],
  "Vorlauf": [
    "Flow",
    "Départ",
    "Impulsión",
    "Mandata",
    "Ida"
  ],
  "Heizkurvendaten werden geladen …": [
    "Loading heating curve data …",
    "Chargement de la courbe de chauffe…",
    "Cargando datos de la curva de calefacción…",
    "Caricamento dei dati della curva climatica …",
    "A carregar dados da curva de aquecimento …"
  ],
  "Verbindung unterbrochen. Übernahme gesperrt.": [
    "Connection interrupted. Applying changes is blocked.",
    "Connexion interrompue. Application bloquée.",
    "Conexión interrumpida. Aplicación bloqueada.",
    "Connessione interrotta. Applicazione bloccata.",
    "Ligação interrompida. Aplicação bloqueada."
  ],
  "Kurvenwerte fehlen. Empfangene Einzelwerte stehen an den Feldern; eine vollständige Vorschau ist noch nicht möglich.": [
    "Curve values are missing. Received values appear beside the fields; a complete preview is not yet available.",
    "Valeurs de courbe manquantes. Les valeurs reçues figurent à côté des champs ; un aperçu complet n’est pas encore possible.",
    "Faltan valores de la curva. Los recibidos aparecen junto a los campos; todavía no es posible una vista previa completa.",
    "Mancano valori della curva. I singoli valori ricevuti sono mostrati accanto ai campi; un’anteprima completa non è ancora possibile.",
    "Faltam valores da curva. Os valores individuais recebidos estão junto aos campos; ainda não é possível uma pré-visualização completa."
  ],
  "Übernahme nach Prüfung und Bestätigung möglich.": [
    "Changes can be applied after checking and confirmation.",
    "Application possible après vérification et confirmation.",
    "Se pueden aplicar cambios tras verificarlos y confirmarlos.",
    "Applicazione possibile dopo verifica e conferma.",
    "É possível aplicar após verificação e confirmação."
  ],
  "Festwertregelung aktiv: Diese Kurve bestimmt derzeit nicht den Vorlauf-Sollwert.": [
    "Fixed setpoint control active: this curve currently does not determine the flow setpoint.",
    "Régulation à consigne fixe active : cette courbe ne détermine pas actuellement la consigne de départ.",
    "Regulación con consigna fija activa: esta curva no determina actualmente la consigna de impulsión.",
    "Regolazione a valore fisso attiva: questa curva attualmente non determina il setpoint di mandata.",
    "Regulação por valor fixo ativa: esta curva não determina atualmente a temperatura de ida definida."
  ],
  "Kurvenkonfiguration nicht vollständig aktuell. Das Diagramm zeigt gegebenenfalls die zuletzt gelesenen Werte.": [
    "Curve configuration is not fully current. The chart may show the last values read.",
    "La configuration de la courbe n’est pas entièrement à jour. Le graphique peut montrer les dernières valeurs lues.",
    "La configuración de la curva no está completamente actualizada. El gráfico puede mostrar los últimos valores leídos.",
    "La configurazione della curva non è completamente aggiornata. Il grafico potrebbe mostrare gli ultimi valori letti.",
    "A configuração da curva não está totalmente atualizada. O gráfico pode apresentar os últimos valores lidos."
  ],
  "Anlagenwerte wurden extern geändert. Deine Eingaben bleiben erhalten.": [
    "System values were changed externally. Your entries are retained.",
    "Les valeurs ont été modifiées ailleurs. Vos saisies sont conservées.",
    "Los valores se han modificado externamente. Se conservan tus entradas.",
    "I valori dell’impianto sono stati modificati esternamente. I tuoi dati inseriti vengono mantenuti.",
    "Os valores da instalação foram alterados externamente. As suas entradas são mantidas."
  ],
  "Neue Anlagenwerte laden": [
    "Load new system values",
    "Charger les nouvelles valeurs",
    "Cargar los nuevos valores",
    "Carica i nuovi valori dell’impianto",
    "Carregar novos valores da instalação"
  ],
  "Eigene Eingaben beibehalten": [
    "Keep my entries",
    "Conserver mes saisies",
    "Conservar mis entradas",
    "Mantieni i dati inseriti",
    "Manter as minhas entradas"
  ],
  "Beibehalten verlangt eine neue Prüfung und Bestätigung.": [
    "Keeping entries requires a new check and confirmation.",
    "Conserver les saisies nécessite une nouvelle vérification et confirmation.",
    "Conservar las entradas requiere una nueva verificación y confirmación.",
    "Il mantenimento richiede una nuova verifica e conferma.",
    "Manter as entradas exige nova verificação e confirmação."
  ],
  "Lokale Vorschau · ungespeichert": [
    "Local preview · Unsaved",
    "Aperçu local · Non enregistré",
    "Vista previa local · Sin guardar",
    "Anteprima locale · non salvata",
    "Pré-visualização local · não guardada"
  ],
  "Gelesene Heizkurve": [
    "Read heating curve",
    "Courbe de chauffe lue",
    "Curva de calefacción leída",
    "Curva climatica letta",
    "Curva de aquecimento lida"
  ],
  "Bitte Eingaben korrigieren, um die Kurve darzustellen.": [
    "Please correct entries to display the curve.",
    "Corrigez les saisies pour afficher la courbe.",
    "Corrige las entradas para mostrar la curva.",
    "Correggi i valori inseriti per visualizzare la curva.",
    "Corrija as entradas para apresentar a curva."
  ],
  "Warte auf vollständige Kurvenwerte.": [
    "Waiting for complete curve values.",
    "En attente des valeurs complètes de la courbe.",
    "Esperando los valores completos de la curva.",
    "In attesa di valori completi della curva.",
    "A aguardar valores completos da curva."
  ],
  "Steigung": [
    "Slope",
    "Pente",
    "Pendiente",
    "Pendenza",
    "Inclinação"
  ],
  "Berechneter Kurvenwert": [
    "Calculated curve value",
    "Valeur de courbe calculée",
    "Valor calculado de la curva",
    "Valore calcolato della curva",
    "Valor calculado da curva"
  ],
  "Außenwert außerhalb des Diagrammbereichs (−40 bis +50 °C). Keine Außenmarkierung dargestellt.": [
    "Outdoor value outside the chart range (−40 to +50 °C). No outdoor marker displayed.",
    "Valeur extérieure hors du graphique (−40 à +50 °C). Aucun repère extérieur affiché.",
    "Valor exterior fuera del gráfico (−40 a +50 °C). No se muestra el marcador exterior.",
    "Temperatura esterna fuori dall’intervallo del grafico (da −40 a +50 °C). Indicatore esterno non visualizzato.",
    "Temperatura exterior fora do intervalo do gráfico (−40 a +50 °C). Não é apresentado o marcador exterior."
  ],
  "Kurvenwert und gemeldeter Anlagen-Sollwert (TOP7) können durch Betriebszustand und Verschiebungen abweichen.": [
    "The curve value and reported system setpoint (TOP7) may differ due to operating state and offsets.",
    "La valeur de courbe et la consigne indiquée (TOP7) peuvent différer selon l’état de fonctionnement et les décalages.",
    "El valor de la curva y la consigna indicada (TOP7) pueden diferir según el estado de funcionamiento y los desplazamientos.",
    "Il valore della curva e il setpoint segnalato dall’impianto (TOP7) possono differire per lo stato operativo e gli scostamenti.",
    "O valor da curva e o valor definido comunicado pela instalação (TOP7) podem diferir devido ao estado de funcionamento e aos desvios aplicados."
  ],
  "Heizgrenze in der Vorschau überschritten.": [
    "Heating cutoff exceeded in preview.",
    "Seuil d’arrêt dépassé dans l’aperçu.",
    "Límite de calefacción superado en la vista previa.",
    "Limite di riscaldamento superato nell’anteprima.",
    "Limite de aquecimento excedido na pré-visualização."
  ],
  "Heizgrenze in der Vorschau nicht überschritten.": [
    "Heating cutoff not exceeded in preview.",
    "Seuil d’arrêt non dépassé dans l’aperçu.",
    "Límite de calefacción no superado en la vista previa.",
    "Limite di riscaldamento non superato nell’anteprima.",
    "Limite de aquecimento não excedido na pré-visualização."
  ],
  "Grenzvergleich wegen fehlender aktueller Werte nicht verfügbar.": [
    "Cutoff comparison unavailable because current values are missing.",
    "Comparaison du seuil indisponible faute de valeurs actuelles.",
    "Comparación del límite no disponible por falta de valores actuales.",
    "Confronto con il limite non disponibile per mancanza di valori aggiornati.",
    "Comparação com o limite indisponível por falta de valores atuais."
  ],
  "Der Vergleich beschreibt keinen gemessenen Schaltzustand.": [
    "The comparison does not describe a measured switching state.",
    "La comparaison ne décrit pas un état de commutation mesuré.",
    "La comparación no describe un estado de conmutación medido.",
    "Il confronto non descrive uno stato di commutazione misurato.",
    "A comparação não representa um estado de comutação medido."
  ],
  "Aktuelle Heizgrenze überschritten.": [
    "Current heating cutoff exceeded.",
    "Seuil d’arrêt actuel dépassé.",
    "Límite actual de calefacción superado.",
    "Limite di riscaldamento attuale superato.",
    "Limite de aquecimento atual excedido."
  ],
  "Aktuelle Heizgrenze nicht überschritten.": [
    "Current heating cutoff not exceeded.",
    "Seuil d’arrêt actuel non dépassé.",
    "Límite actual de calefacción no superado.",
    "Limite di riscaldamento attuale non superato.",
    "Limite de aquecimento atual não excedido."
  ],
  "Heizgrenzenstatus unbekannt.": [
    "Heating cutoff status unknown.",
    "État du seuil d’arrêt inconnu.",
    "Estado del límite de calefacción desconocido.",
    "Stato del limite di riscaldamento sconosciuto.",
    "Estado do limite de aquecimento desconhecido."
  ],
  "Der Warmpunkt liegt oberhalb der Heizgrenze.": [
    "The warm point is above the heating cutoff.",
    "Le point chaud est au-dessus du seuil d’arrêt.",
    "El punto cálido está por encima del límite de calefacción.",
    "Il punto caldo è superiore al limite di riscaldamento.",
    "O ponto quente está acima do limite de aquecimento."
  ],
  "Die Kurve ist flach: Beide Vorlaufwerte sind gleich.": [
    "The curve is flat: both flow values are equal.",
    "La courbe est plate : les deux valeurs de départ sont égales.",
    "La curva es plana: ambos valores de impulsión son iguales.",
    "La curva è piatta: i due valori di mandata sono uguali.",
    "A curva é plana: as duas temperaturas de ida são iguais."
  ],
  "Eckpunkte einstellen": [
    "Set endpoints",
    "Régler les points de référence",
    "Ajustar los puntos de referencia",
    "Imposta i punti estremi",
    "Ajustar pontos de referência"
  ],
  "Direkte Eingaben mit Enter oder beim Verlassen des Feldes übernehmen. Escape verwirft die Eingabe.": [
    "Apply direct entries with Enter or when leaving the field. Escape discards the entry.",
    "Validez avec Entrée ou en quittant le champ. Échap annule la saisie.",
    "Aplica las entradas con Intro o al salir del campo. Escape descarta la entrada.",
    "Applica i valori con Invio o uscendo dal campo. Esc annulla l’immissione.",
    "Aplicar entradas diretas com Enter ou ao sair do campo. Escape descarta a entrada."
  ],
  "Kaltpunkt": [
    "Cold point",
    "Point froid",
    "Punto frío",
    "Punto freddo",
    "Ponto frio"
  ],
  "Warmpunkt": [
    "Warm point",
    "Point chaud",
    "Punto cálido",
    "Punto caldo",
    "Ponto quente"
  ],
  "Oberhalb dieser Außentemperatur bleibt der Heizbetrieb ausgeschaltet.": [
    "Heating stays off above this outdoor temperature.",
    "Le chauffage reste arrêté au-dessus de cette température extérieure.",
    "La calefacción permanece apagada por encima de esta temperatura exterior.",
    "Al di sopra di questa temperatura esterna, il riscaldamento rimane spento.",
    "Acima desta temperatura exterior, o aquecimento permanece desligado."
  ],
  "Soll-Differenz zwischen Vorlauf und Rücklauf; kein Toleranzband.": [
    "Target difference between flow and return; not a tolerance band.",
    "Écart de consigne entre départ et retour ; pas une bande de tolérance.",
    "Diferencia objetivo entre impulsión y retorno; no es una banda de tolerancia.",
    "Differenza impostata tra mandata e ritorno; non è una banda di tolleranza.",
    "Diferença definida entre ida e retorno; não é uma banda de tolerância."
  ],
  "Rücklauf": [
    "Return",
    "Retour",
    "Retorno",
    "Ritorno",
    "Retorno"
  ],
  "Gemessene Spreizung:": [
    "Measured temperature difference:",
    "Écart de température mesuré :",
    "Diferencia de temperatura medida:",
    "Differenza di temperatura misurata:",
    "Diferença de temperatura medida:"
  ],
  "Zurücksetzen": [
    "Reset",
    "Réinitialiser",
    "Restablecer",
    "Ripristina",
    "Repor"
  ],
  "Vorschau": [
    "Preview",
    "Aperçu",
    "Vista previa",
    "Anteprima",
    "Pré-visualização"
  ],
  "Heizkurve übernehmen": [
    "Apply heating curve",
    "Appliquer la courbe de chauffe",
    "Aplicar la curva de calefacción",
    "Applica la curva climatica",
    "Aplicar curva de aquecimento"
  ],
  "Vorschau aktualisiert. Keine Änderung gesendet.": [
    "Preview updated. No change sent.",
    "Aperçu actualisé. Aucune modification envoyée.",
    "Vista previa actualizada. No se ha enviado ningún cambio.",
    "Anteprima aggiornata. Nessuna modifica inviata.",
    "Pré-visualização atualizada. Nenhuma alteração enviada."
  ],
  "Ungespeicherte Eingaben": [
    "Unsaved entries",
    "Saisies non enregistrées",
    "Entradas sin guardar",
    "Dati inseriti non salvati",
    "Entradas não guardadas"
  ],
  "Keine lokalen Änderungen": [
    "No local changes",
    "Aucune modification locale",
    "Sin cambios locales",
    "Nessuna modifica locale",
    "Sem alterações locais"
  ],
  "Bedienerzugang": [
    "Operator access",
    "Accès opérateur",
    "Acceso del operador",
    "Accesso operatore",
    "Acesso de operador"
  ],
  "· Simulation": [
    "· Simulation",
    "· Simulation",
    "· Simulación",
    "· Simulazione",
    "· Simulação"
  ],
  "· reale Anlage": [
    "· Real system",
    "· Installation réelle",
    "· Instalación real",
    "· impianto reale",
    "· instalação real"
  ],
  "Leser": [
    "Reader",
    "Lecteur",
    "Lector",
    "Lettore",
    "Leitor"
  ],
  "Heizkurve bestätigen": [
    "Confirm heating curve",
    "Confirmer la courbe de chauffe",
    "Confirmar la curva de calefacción",
    "Conferma la curva climatica",
    "Confirmar curva de aquecimento"
  ],
  "Änderungen ausdrücklich bestätigen": [
    "Explicitly confirm changes",
    "Confirmer explicitement les modifications",
    "Confirmar expresamente los cambios",
    "Conferma esplicitamente le modifiche",
    "Confirmar explicitamente as alterações"
  ],
  "Drei Parametergruppen sind keine atomare Änderung. Nach einem Fehler werden weitere Teile nicht gesendet. Bereits geänderte Werte bleiben bestehen.": [
    "The three parameter groups are not an atomic change. After an error, no further parts are sent. Values already changed remain in place.",
    "Les trois groupes de paramètres ne forment pas une modification atomique. Après une erreur, les parties suivantes ne sont pas envoyées. Les valeurs déjà modifiées sont conservées.",
    "Los tres grupos de parámetros no constituyen un cambio atómico. Tras un error no se envían más partes. Los valores ya modificados se mantienen.",
    "Tre gruppi di parametri non costituiscono una modifica atomica. Dopo un errore, le parti successive non vengono inviate. I valori già modificati rimangono tali.",
    "Os três grupos de parâmetros não constituem uma alteração atómica. Após um erro, as partes seguintes não são enviadas. Os valores já alterados mantêm-se."
  ],
  "Parameter": [
    "Parameter",
    "Paramètre",
    "Parámetro",
    "Parametro",
    "Parâmetro"
  ],
  "Bisher": [
    "Previous",
    "Précédent",
    "Anterior",
    "Precedente",
    "Anterior"
  ],
  "Gewünscht": [
    "Desired",
    "Souhaité",
    "Deseado",
    "Desiderato",
    "Pretendido"
  ],
  "Jetzt bestätigt senden": [
    "Confirm and send now",
    "Confirmer et envoyer maintenant",
    "Confirmar y enviar ahora",
    "Conferma e invia ora",
    "Confirmar e enviar agora"
  ],
  "Entwurf verwerfen": [
    "Discard draft",
    "Abandonner le brouillon",
    "Descartar borrador",
    "Scarta la bozza",
    "Descartar rascunho"
  ],
  "Heizkurven-Protokoll": [
    "Heating curve log",
    "Journal de la courbe de chauffe",
    "Registro de la curva de calefacción",
    "Registro della curva climatica",
    "Registo da curva de aquecimento"
  ],
  "Übernahme und Rücklesen": [
    "Application and readback",
    "Application et relecture",
    "Aplicación y lectura de retorno",
    "Applicazione e rilettura",
    "Aplicação e leitura de retorno"
  ],
  "Rücklesefrist je Teil:": [
    "Readback timeout per part:",
    "Délai de relecture par partie :",
    "Plazo de lectura de retorno por parte:",
    "Tempo massimo di rilettura per parte:",
    "Prazo de leitura de retorno por parte:"
  ],
  "Sekunden. Eine Übereinstimmung belegt beobachtete Werte, keine eindeutige Befehlsursache. Keine automatische Wiederholung.": [
    "seconds. A match confirms observed values, not definite causation by the command. No automatic retry.",
    "secondes. Une concordance atteste des valeurs observées, pas d’un effet certain de la commande. Aucun nouvel essai automatique.",
    "segundos. Una coincidencia demuestra valores observados, no una causa inequívoca de la orden. Sin reintentos automáticos.",
    "secondi. Una corrispondenza dimostra i valori osservati, non un nesso causale certo con il comando. Nessuna ripetizione automatica.",
    "segundos. Uma correspondência comprova os valores observados, mas não que o comando os tenha causado. Sem repetição automática."
  ],
  "Alt-, Soll- und Rücklesewerte": [
    "Previous, target and readback values",
    "Valeurs précédentes, de consigne et relues",
    "Valores anteriores, de consigna y de retorno",
    "Valori precedenti, desiderati e riletti",
    "Valores anteriores, definidos e lidos de retorno"
  ],
  "Alt": [
    "Previous",
    "Ancien",
    "Anterior",
    "Precedente",
    "Anterior"
  ],
  "Soll": [
    "Target",
    "Consigne",
    "Consigna",
    "Setpoint",
    "Definido"
  ],
  "Beobachtet": [
    "Observed",
    "Observé",
    "Observado",
    "Osservato",
    "Observado"
  ],
  "Pumpendrehzahl": [
    "Pump speed",
    "Vitesse de la pompe",
    "Velocidad de la bomba",
    "Velocità della pompa",
    "Velocidade da bomba"
  ],
  "Ventilatordrehzahl": [
    "Fan speed",
    "Vitesse du ventilateur",
    "Velocidad del ventilador",
    "Velocità del ventilatore",
    "Velocidade do ventilador"
  ],
  "Verdichterstrom": [
    "Compressor current",
    "Courant du compresseur",
    "Corriente del compresor",
    "Corrente del compressore",
    "Corrente do compressor"
  ],
  "Hochdruck": [
    "High pressure",
    "Haute pression",
    "Alta presión",
    "Alta pressione",
    "Alta pressão"
  ],
  "Heizkurve Außen niedrig": [
    "Heating curve: low outdoor",
    "Courbe : extérieur bas",
    "Curva: exterior bajo",
    "Curva climatica: esterno basso",
    "Curva de aquecimento: exterior baixo"
  ],
  "Heizkurve Vorlauf hoch": [
    "Heating curve: high flow",
    "Courbe : départ haut",
    "Curva: impulsión alta",
    "Curva climatica: mandata alta",
    "Curva de aquecimento: ida alta"
  ],
  "Heizkurve Außen hoch": [
    "Heating curve: high outdoor",
    "Courbe : extérieur haut",
    "Curva: exterior alto",
    "Curva climatica: esterno alto",
    "Curva de aquecimento: exterior alto"
  ],
  "Heizkurve Vorlauf niedrig": [
    "Heating curve: low flow",
    "Courbe : départ bas",
    "Curva: impulsión baja",
    "Curva climatica: mandata bassa",
    "Curva de aquecimento: ida baixa"
  ],
  "Vorlauf-Soll (Anlage)": [
    "Flow setpoint (system)",
    "Consigne de départ (installation)",
    "Consigna de impulsión (instalación)",
    "Setpoint di mandata (impianto)",
    "Temperatura de ida definida (instalação)"
  ],
  "Aktive Zonen": [
    "Active zones",
    "Zones actives",
    "Zonas activas",
    "Zone attive",
    "Zonas ativas"
  ],
  "Innen": [
    "Indoor",
    "Intérieur",
    "Interior",
    "Interno",
    "Interior"
  ],
  "Innen-Soll": [
    "Indoor setpoint",
    "Consigne intérieure",
    "Consigna interior",
    "Setpoint ambiente",
    "Temperatura interior definida"
  ],
  "Heizanforderung Zone 1": [
    "Zone 1 heating request",
    "Demande de chauffage zone 1",
    "Demanda de calefacción zona 1",
    "Richiesta di riscaldamento zona 1",
    "Pedido de aquecimento da zona 1"
  ],
  "Sensormodus Zone 1": [
    "Zone 1 sensor mode",
    "Mode du capteur zone 1",
    "Modo del sensor zona 1",
    "Modalità sensore zona 1",
    "Modo do sensor da zona 1"
  ],
  "Warmwasser": [
    "Hot water",
    "Eau chaude",
    "Agua caliente",
    "Acqua calda",
    "Água quente"
  ],
  "Warmwasser-Einschaltdifferenz": [
    "Hot water start differential",
    "Différentiel de démarrage de l’eau chaude",
    "Diferencial de arranque del agua caliente",
    "Differenziale di accensione acqua calda",
    "Diferencial de arranque da água quente"
  ],
  "Warmwasser-Soll": [
    "Hot water setpoint",
    "Consigne d’eau chaude",
    "Consigna de agua caliente",
    "Setpoint acqua calda",
    "Temperatura de água quente definida"
  ],
  "Spreizung": [
    "Temperature difference",
    "Écart de température",
    "Diferencia de temperatura",
    "Differenza di temperatura",
    "Diferença de temperatura"
  ],
  "Wärmepumpe": [
    "Heat pump",
    "Pompe à chaleur",
    "Bomba de calor",
    "Pompa di calore",
    "Bomba de calor"
  ],
  "Betriebsart": [
    "Operating mode",
    "Mode de fonctionnement",
    "Modo de funcionamiento",
    "Modalità operativa",
    "Modo de funcionamento"
  ],
  "Heizstab": [
    "Backup heater",
    "Résistance électrique",
    "Resistencia eléctrica",
    "Resistenza elettrica",
    "Resistência elétrica"
  ],
  "Heizregelung": [
    "Heating control",
    "Régulation du chauffage",
    "Regulación de calefacción",
    "Regolazione del riscaldamento",
    "Regulação do aquecimento"
  ],
  "Fehlerstatus": [
    "Fault status",
    "État des défauts",
    "Estado de fallos",
    "Stato di errore",
    "Estado de erro"
  ],
  "Durchfluss": [
    "Flow rate",
    "Débit",
    "Caudal",
    "Portata",
    "Caudal"
  ],
  "Verdichter": [
    "Compressor",
    "Compresseur",
    "Compresor",
    "Compressore",
    "Compressor"
  ],
  "Abtauen": [
    "Defrosting",
    "Dégivrage",
    "Desescarche",
    "Sbrinamento",
    "Descongelação"
  ],
  "3-Wege-Ventil": [
    "3-way valve",
    "Vanne 3 voies",
    "Válvula de 3 vías",
    "Valvola a 3 vie",
    "Válvula de 3 vias"
  ],
  "Betriebsstunden": [
    "Operating hours",
    "Heures de fonctionnement",
    "Horas de funcionamiento",
    "Ore di funzionamento",
    "Horas de funcionamento"
  ],
  "Betriebszähler": [
    "Start counter",
    "Compteur de démarrages",
    "Contador de arranques",
    "Conteggio avviamenti",
    "Contador de arranques"
  ],
  "Wasserdruck": [
    "Water pressure",
    "Pression d’eau",
    "Presión del agua",
    "Pressione dell’acqua",
    "Pressão da água"
  ],
  "Heizen elektrisch": [
    "Heating electrical",
    "Chauffage électrique",
    "Calefacción eléctrica",
    "Riscaldamento elettrico",
    "Potência elétrica de aquecimento"
  ],
  "Kühlen elektrisch": [
    "Cooling electrical",
    "Refroidissement électrique",
    "Refrigeración eléctrica",
    "Raffrescamento elettrico",
    "Potência elétrica de arrefecimento"
  ],
  "Warmwasser elektrisch": [
    "Hot water electrical",
    "Eau chaude électrique",
    "Agua caliente eléctrica",
    "Acqua calda elettrica",
    "Potência elétrica de água quente"
  ],
  "Heizen thermisch": [
    "Heating thermal",
    "Chauffage thermique",
    "Calefacción térmica",
    "Riscaldamento termico",
    "Potência térmica de aquecimento"
  ],
  "Kühlen thermisch": [
    "Cooling thermal",
    "Refroidissement thermique",
    "Refrigeración térmica",
    "Raffrescamento termico",
    "Potência térmica de arrefecimento"
  ],
  "Warmwasser thermisch": [
    "Hot water thermal",
    "Eau chaude thermique",
    "Agua caliente térmica",
    "Acqua calda termica",
    "Potência térmica de água quente"
  ],
  "Sterilisation": [
    "Sterilisation",
    "Stérilisation",
    "Esterilización",
    "Sterilizzazione",
    "Esterilização"
  ],
  "Broker": [
    "Broker",
    "Broker",
    "Bróker",
    "Broker",
    "Broker"
  ],
  "Gerät": [
    "Device",
    "Appareil",
    "Dispositivo",
    "Dispositivo",
    "Dispositivo"
  ],
  "Aufzeichnung": [
    "Recording",
    "Enregistrement",
    "Registro",
    "Registrazione",
    "Registo"
  ],
  "System": [
    "System",
    "Système",
    "Sistema",
    "Sistema",
    "Sistema"
  ],
  "Verbindung": [
    "Connection",
    "Connexion",
    "Conexión",
    "Connessione",
    "Ligação"
  ],
  "Datenqualität": [
    "Data quality",
    "Qualité des données",
    "Calidad de los datos",
    "Qualità dei dati",
    "Qualidade dos dados"
  ],
  "Zustandsänderung": [
    "State change",
    "Changement d’état",
    "Cambio de estado",
    "Cambio di stato",
    "Alteração de estado"
  ],
  "Daten konnten nicht geladen werden.": [
    "Unable to load data.",
    "Impossible de charger les données.",
    "No se pudieron cargar los datos.",
    "Impossibile caricare i dati.",
    "Não foi possível carregar os dados."
  ],
  "Aufzeichnung gestört oder nicht erreichbar. Es können Datenlücken entstehen; Livewerte und gespeicherte Daten getrennt prüfen.": [
    "Recording failed or unavailable. Gaps may occur; check live readings and stored data separately.",
    "Enregistrement défaillant ou inaccessible. Des lacunes sont possibles ; vérifiez séparément les valeurs en direct et les données enregistrées.",
    "Registro con fallo o inaccesible. Pueden aparecer lagunas; comprueba por separado los valores en directo y los datos guardados.",
    "Registrazione interrotta o non raggiungibile. Possono verificarsi lacune nei dati; verifica separatamente i valori in tempo reale e i dati salvati.",
    "Registo com falha ou inacessível. Podem ocorrer lacunas nos dados; verifique separadamente os valores em direto e os dados guardados."
  ],
  "Aufzeichnung aktiv": [
    "Recording active",
    "Enregistrement actif",
    "Registro activo",
    "Registrazione attiva",
    "Registo ativo"
  ],
  "Aufzeichnung wird gestartet": [
    "Starting recording",
    "Démarrage de l’enregistrement",
    "Iniciando registro",
    "Avvio della registrazione",
    "A iniciar o registo"
  ],
  "s Raster ·": [
    "s sampling ·",
    "s d’échantillonnage ·",
    "s de muestreo ·",
    "s di campionamento ·",
    "s de intervalo ·"
  ],
  "Tage Aufbewahrung": [
    "days retention",
    "jours de conservation",
    "días de conservación",
    "giorni di conservazione",
    "dias de retenção"
  ],
  "Export fehlgeschlagen.": [
    "Export failed.",
    "Échec de l’exportation.",
    "Error de exportación.",
    "Esportazione non riuscita.",
    "A exportação falhou."
  ],
  "Temperaturverlauf": [
    "Temperature history",
    "Historique des températures",
    "Historial de temperaturas",
    "Andamento delle temperature",
    "Histórico de temperaturas"
  ],
  "Temperaturen": [
    "Temperatures",
    "Températures",
    "Temperaturas",
    "Temperature",
    "Temperaturas"
  ],
  "Verlaufszeitraum": [
    "History period",
    "Période de l’historique",
    "Periodo del historial",
    "Periodo dello storico",
    "Período do histórico"
  ],
  " Tage": [
    " days",
    " jours",
    " días",
    " giorni",
    " dias"
  ],
  "Aktualisieren": [
    "Refresh",
    "Actualiser",
    "Actualizar",
    "Aggiorna",
    "Atualizar"
  ],
  "Bitte einen gültigen Zeitraum bis 700 Tage wählen.": [
    "Please select a valid period of up to 700 days.",
    "Sélectionnez une période valide de 700 jours maximum.",
    "Selecciona un periodo válido de hasta 700 días.",
    "Seleziona un periodo valido fino a 700 giorni.",
    "Selecione um período válido de até 700 dias."
  ],
  "Von (UTC)": [
    "From (UTC)",
    "Du (UTC)",
    "Desde (UTC)",
    "Da (UTC)",
    "De (UTC)"
  ],
  "Bis (UTC)": [
    "To (UTC)",
    "Au (UTC)",
    "Hasta (UTC)",
    "A (UTC)",
    "Até (UTC)"
  ],
  "Zeitraum anzeigen": [
    "Show period",
    "Afficher la période",
    "Mostrar periodo",
    "Mostra il periodo",
    "Mostrar período"
  ],
  "Diagrammsteuerung": [
    "Chart controls",
    "Commandes du graphique",
    "Controles del gráfico",
    "Controlli del grafico",
    "Controlos do gráfico"
  ],
  "Vergrößern": [
    "Zoom in",
    "Agrandir",
    "Acercar",
    "Ingrandisci",
    "Ampliar"
  ],
  "Verkleinern": [
    "Zoom out",
    "Réduire",
    "Alejar",
    "Riduci",
    "Reduzir"
  ],
  "Zoom zurücksetzen": [
    "Reset zoom",
    "Réinitialiser le zoom",
    "Restablecer zoom",
    "Reimposta lo zoom",
    "Repor zoom"
  ],
  "Live folgen": [
    "Follow live",
    "Suivre en direct",
    "Seguir en directo",
    "Segui in tempo reale",
    "Seguir em direto"
  ],
  "Spreizungsband": [
    "Temperature difference band",
    "Bande d’écart de température",
    "Banda de diferencia de temperatura",
    "Banda della differenza di temperatura",
    "Banda da diferença de temperatura"
  ],
  "Sterilisationsmarkierungen": [
    "Sterilisation markers",
    "Repères de stérilisation",
    "Marcadores de esterilización",
    "Indicatori di sterilizzazione",
    "Marcadores de esterilização"
  ],
  "Auswahl:": [
    "Selection:",
    "Sélection :",
    "Selección:",
    "Selezione:",
    "Seleção:"
  ],
  "· Zoom auch mit Strg + Mausrad oder den Zeitreglern.": [
    "· Zoom also with Ctrl + mouse wheel or the time sliders.",
    "· Zoom aussi avec Ctrl + molette ou les curseurs de temps.",
    "· También puedes ampliar con Ctrl + rueda o los deslizadores de tiempo.",
    "· Zoom anche con Ctrl + rotellina o con i cursori temporali.",
    "· Zoom também com Ctrl + roda do rato ou os seletores de tempo."
  ],
  "Messwerte": [
    "Readings",
    "Mesures",
    "Mediciones",
    "Valori misurati",
    "Medições"
  ],
  "Export läuft …": [
    "Exporting …",
    "Exportation en cours…",
    "Exportando…",
    "Esportazione in corso …",
    "A exportar …"
  ],
  "Rohdatenexport des angezeigten Zeitraums: maximal 30 Tage und 100.000 Zeilen. Bei größeren Zeiträumen bitte die Auswahl verkleinern. Die Freigabe verwendet vorsichtig die erwarteten Rasterzeilen.": [
    "Raw data export for the displayed period: up to 30 days and 100,000 rows. For longer periods, narrow the selection. Availability conservatively uses the expected sampling rows.",
    "Export des données brutes de la période affichée : 30 jours et 100 000 lignes maximum. Réduisez la sélection pour les périodes plus longues. La disponibilité repose prudemment sur le nombre de lignes attendu.",
    "Exportación de datos originales del periodo mostrado: hasta 30 días y 100.000 filas. Reduce la selección para periodos mayores. La disponibilidad se calcula de forma conservadora con las filas esperadas.",
    "Esportazione dei dati grezzi del periodo visualizzato: massimo 30 giorni e 100.000 righe. Per periodi più lunghi, riduci la selezione. L’autorizzazione considera prudenzialmente le righe di campionamento previste.",
    "Exportação dos dados brutos do período apresentado: no máximo 30 dias e 100.000 linhas. Para períodos maiores, reduza a seleção. A autorização usa, por precaução, o número esperado de linhas da grelha temporal."
  ],
  "· Angezeigte Daten stammen gegebenenfalls aus der vorherigen Abfrage.": [
    "· Displayed data may be from the previous query.",
    "· Les données affichées peuvent provenir de la requête précédente.",
    "· Los datos mostrados pueden proceder de la consulta anterior.",
    "· I dati visualizzati potrebbero provenire dalla richiesta precedente.",
    "· Os dados apresentados podem pertencer à consulta anterior."
  ],
  "Verlauf wird geladen … Bisherige Daten bleiben bis zum Abschluss mit bisheriger Auflösung sichtbar.": [
    "Loading history … Previous data remains visible at its previous resolution until loading completes.",
    "Chargement de l’historique… Les données précédentes restent visibles à leur résolution précédente jusqu’à la fin du chargement.",
    "Cargando historial… Los datos anteriores permanecen visibles con su resolución anterior hasta finalizar la carga.",
    "Caricamento dello storico … I dati precedenti rimangono visibili con la risoluzione precedente fino al completamento.",
    "A carregar o histórico … Os dados anteriores permanecem visíveis com a resolução anterior até à conclusão."
  ],
  "Spreizungsband: gleiche Rasterplätze, Empfangsabstand höchstens": [
    "Temperature difference band: same sampling slots, reception interval at most",
    "Bande d’écart : mêmes créneaux, intervalle de réception maximal de",
    "Banda de diferencia: mismos intervalos, separación de recepción máxima de",
    "Banda della differenza di temperatura: stessi intervalli di campionamento, distanza tra le ricezioni al massimo",
    "Banda da diferença de temperatura: mesmas posições na grelha temporal, intervalo de receção máximo de"
  ],
  "s. Nur vollständige Paarintervalle; keine gehaltenen Ersatzwerte.": [
    "s. Complete paired intervals only; no held substitute values.",
    "s. Uniquement des intervalles appariés complets ; aucune valeur de remplacement conservée.",
    "s. Solo intervalos emparejados completos; sin valores sustitutos retenidos.",
    "s. Solo intervalli con coppie complete; nessun valore sostitutivo mantenuto.",
    "s. Apenas intervalos de pares completos; sem valores de substituição mantidos."
  ],
  "Wertepaare und Abdeckung (letzte 20 Intervalle)": [
    "Value pairs and coverage (last 20 intervals)",
    "Paires de valeurs et couverture (20 derniers intervalles)",
    "Pares de valores y cobertura (últimos 20 intervalos)",
    "Coppie di valori e copertura (ultimi 20 intervalli)",
    "Pares de valores e cobertura (últimos 20 intervalos)"
  ],
  "Zeit · Berlin": [
    "Time · Berlin",
    "Heure · Berlin",
    "Hora · Berlín",
    "Ora · Berlino",
    "Hora · Berlim"
  ],
  "Vorlauf / Rücklauf": [
    "Flow / Return",
    "Départ / Retour",
    "Impulsión / Retorno",
    "Mandata / Ritorno",
    "Ida / Retorno"
  ],
  "Gültige / erwartete Paare": [
    "Valid / Expected pairs",
    "Paires valides / attendues",
    "Pares válidos / esperados",
    "Coppie valide / previste",
    "Pares válidos / esperados"
  ],
  "Sterilisationsereignisse": [
    "Sterilisation events",
    "Événements de stérilisation",
    "Eventos de esterilización",
    "Eventi di sterilizzazione",
    "Eventos de esterilização"
  ],
  "Beobachteter Sterilisationsstatus": [
    "Observed sterilisation status",
    "État de stérilisation observé",
    "Estado de esterilización observado",
    "Stato di sterilizzazione osservato",
    "Estado de esterilização observado"
  ],
  "TOP69-Aktivstatus; kein Nachweis eines abgeschlossenen Sterilisationslaufs. Markierungen zeigen beobachtete Wechsel, Flächen bekannte Aktivintervalle.": [
    "TOP69 active status; not proof of a completed sterilisation cycle. Markers show observed transitions, shaded areas show known active intervals.",
    "État actif TOP69 ; aucune preuve d’un cycle de stérilisation terminé. Les repères indiquent les transitions observées, les surfaces les intervalles actifs connus.",
    "Estado activo TOP69; no demuestra un ciclo de esterilización completo. Los marcadores muestran cambios observados y las áreas indican intervalos activos conocidos.",
    "Stato attivo TOP69; non dimostra un ciclo di sterilizzazione completato. Gli indicatori mostrano i cambi osservati, le aree gli intervalli attivi noti.",
    "Estado ativo TOP69; não comprova a conclusão de um ciclo de esterilização. Os marcadores mostram transições observadas, as áreas indicam intervalos ativos conhecidos."
  ],
  "Sterilisationswechsel bei dieser Auflösung nicht auswertbar. Zeitraum verkleinern.": [
    "Sterilisation transitions cannot be analysed at this resolution. Narrow the period.",
    "Transitions de stérilisation non analysables à cette résolution. Réduisez la période.",
    "No se pueden analizar los cambios de esterilización con esta resolución. Reduce el periodo.",
    "Impossibile valutare i cambi di sterilizzazione a questa risoluzione. Riduci il periodo.",
    "Não é possível avaliar transições de esterilização nesta resolução. Reduza o período."
  ],
  "Kein gültiges Aktivintervall im Zeitraum aufgezeichnet.": [
    "No valid active interval recorded in this period.",
    "Aucun intervalle actif valide enregistré sur cette période.",
    "No se ha registrado ningún intervalo activo válido en este periodo.",
    "Nessun intervallo attivo valido registrato nel periodo.",
    "Nenhum intervalo ativo válido registado no período."
  ],
  "Aktivwechsel beobachtet": [
    "Activation observed",
    "Activation observée",
    "Activación observada",
    "Passaggio allo stato attivo osservato",
    "Transição para ativo observada"
  ],
  "Beginn unbekannt oder außerhalb der Auswahl": [
    "Start unknown or outside selection",
    "Début inconnu ou hors sélection",
    "Inicio desconocido o fuera de la selección",
    "Inizio sconosciuto o fuori dalla selezione",
    "Início desconhecido ou fora da seleção"
  ],
  "Inaktivwechsel beobachtet": [
    "Deactivation observed",
    "Désactivation observée",
    "Desactivación observada",
    "Passaggio allo stato inattivo osservato",
    "Transição para inativo observada"
  ],
  "Ende unbekannt oder außerhalb der Auswahl": [
    "End unknown or outside selection",
    "Fin inconnue ou hors sélection",
    "Fin desconocido o fuera de la selección",
    "Fine sconosciuta o fuori dalla selezione",
    "Fim desconhecido ou fora da seleção"
  ],
  "Technische Anlagenwerte": [
    "Technical system readings",
    "Mesures techniques de l’installation",
    "Mediciones técnicas de la instalación",
    "Valori tecnici dell’impianto",
    "Valores técnicos da instalação"
  ],
  "Messwert": [
    "Reading",
    "Mesure",
    "Medición",
    "Valore misurato",
    "Medição"
  ],
  " – Verlauf": [
    " – History",
    " – Historique",
    " – Historial",
    " – Storico",
    " – Histórico"
  ],
  "Gemeinsamer Zeitraum mit den übrigen Verläufen. Hochdruck in kgf/cm²; keine Umrechnung in bar.": [
    "Shared period with the other charts. High pressure in kgf/cm²; no conversion to bar.",
    "Période commune aux autres graphiques. Haute pression en kgf/cm² ; aucune conversion en bar.",
    "Periodo compartido con los demás gráficos. Alta presión en kgf/cm²; sin conversión a bar.",
    "Periodo comune agli altri grafici storici. Alta pressione in kgf/cm²; nessuna conversione in bar.",
    "Período comum aos restantes históricos. Alta pressão em kgf/cm²; sem conversão para bar."
  ],
  "Wasserdruckverlauf": [
    "Water pressure history",
    "Historique de la pression d’eau",
    "Historial de presión del agua",
    "Andamento della pressione dell’acqua",
    "Histórico da pressão da água"
  ],
  "Wasserdruck als CSV": [
    "Water pressure as CSV",
    "Pression d’eau en CSV",
    "Presión del agua en CSV",
    "Pressione dell’acqua in CSV",
    "Pressão da água em CSV"
  ],
  "Beobachtete Betriebszustände": [
    "Observed operating states",
    "États de fonctionnement observés",
    "Estados de funcionamiento observados",
    "Stati operativi osservati",
    "Estados de funcionamento observados"
  ],
  "Betriebszustände": [
    "Operating states",
    "États de fonctionnement",
    "Estados de funcionamiento",
    "Stati operativi",
    "Estados de funcionamento"
  ],
  "Betriebszustände als CSV": [
    "Operating states as CSV",
    "États de fonctionnement en CSV",
    "Estados de funcionamiento en CSV",
    "Stati operativi in CSV",
    "Estados de funcionamento em CSV"
  ],
  "Wärmepumpe/Heizstab/Abtauen: 0 = aus, 1 = ein. Dreiwegeventil: 0 = Raumheizung, 1 = Warmwasser. Betriebsart: 0 Heizen, 1 Kühlen, 2 Auto (Heizen), 3 Warmwasser, 4 Heizen + Warmwasser, 5 Kühlen + Warmwasser, 6 Auto (Heizen) + Warmwasser, 7 Auto (Kühlen), 8 Auto (Kühlen) + Warmwasser.": [
    "Heat pump/heater/defrost: 0 = off, 1 = on. Three-way valve: 0 = space heating, 1 = hot water. Operating mode: 0 Heating, 1 Cooling, 2 Auto (Heating), 3 Hot water, 4 Heating + Hot water, 5 Cooling + Hot water, 6 Auto (Heating) + Hot water, 7 Auto (Cooling), 8 Auto (Cooling) + Hot water.",
    "Pompe à chaleur/résistance/dégivrage : 0 = arrêt, 1 = marche. Vanne 3 voies : 0 = chauffage ambiant, 1 = eau chaude. Mode : 0 Chauffage, 1 Refroidissement, 2 Auto (Chauffage), 3 Eau chaude, 4 Chauffage + Eau chaude, 5 Refroidissement + Eau chaude, 6 Auto (Chauffage) + Eau chaude, 7 Auto (Refroidissement), 8 Auto (Refroidissement) + Eau chaude.",
    "Bomba de calor/resistencia/desescarche: 0 = apagado, 1 = encendido. Válvula de 3 vías: 0 = calefacción ambiente, 1 = agua caliente. Modo: 0 Calefacción, 1 Refrigeración, 2 Auto (Calefacción), 3 Agua caliente, 4 Calefacción + Agua caliente, 5 Refrigeración + Agua caliente, 6 Auto (Calefacción) + Agua caliente, 7 Auto (Refrigeración), 8 Auto (Refrigeración) + Agua caliente.",
    "Pompa di calore/resistenza elettrica/sbrinamento: 0 = spento, 1 = acceso. Valvola a tre vie: 0 = riscaldamento ambienti, 1 = acqua calda. Modalità: 0 Riscaldamento, 1 Raffrescamento, 2 Auto (riscaldamento), 3 Acqua calda, 4 Riscaldamento + acqua calda, 5 Raffrescamento + acqua calda, 6 Auto (riscaldamento) + acqua calda, 7 Auto (raffrescamento), 8 Auto (raffrescamento) + acqua calda.",
    "Bomba de calor/resistência elétrica/descongelação: 0 = desligado, 1 = ligado. Válvula de três vias: 0 = aquecimento ambiente, 1 = água quente. Modo de funcionamento: 0 Aquecimento, 1 Arrefecimento, 2 Auto (Aquecimento), 3 Água quente, 4 Aquecimento + Água quente, 5 Arrefecimento + Água quente, 6 Auto (Aquecimento) + Água quente, 7 Auto (Arrefecimento), 8 Auto (Arrefecimento) + Água quente."
  ],
  "Leistung": [
    "Power",
    "Puissance",
    "Potencia",
    "Potenza",
    "Potência"
  ],
  "Leistungsverlauf": [
    "Power history",
    "Historique de puissance",
    "Historial de potencia",
    "Andamento della potenza",
    "Histórico de potência"
  ],
  "Leistung als CSV": [
    "Power as CSV",
    "Puissance en CSV",
    "Potencia en CSV",
    "Potenza in CSV",
    "Potência em CSV"
  ],
  "Leistungswerte stammen ausschließlich aus den zusätzlichen HeishaMon-Daten (extra). Ohne gültige Nachrichten bleiben sie unbekannt; fehlende Daten beweisen keine fehlende Unterstützung. Kein Rückgriff auf Legacy-Leistungswerte. Die separate COP-Auswertung prüft zusätzlich Paarung und Betriebszustand.": [
    "Power readings come exclusively from additional HeishaMon data (extra). Without valid messages they remain unknown; missing data does not prove a lack of support. Legacy power values are not used. The separate COP analysis also checks pairing and operating state.",
    "Les puissances proviennent exclusivement des données supplémentaires HeishaMon (extra). Sans messages valides, elles restent inconnues ; l’absence de données ne prouve pas l’absence de prise en charge. Les anciennes valeurs de puissance ne sont pas utilisées. L’analyse COP vérifie aussi l’appariement et l’état de fonctionnement.",
    "Las potencias proceden exclusivamente de los datos adicionales de HeishaMon (extra). Sin mensajes válidos siguen siendo desconocidas; la ausencia de datos no demuestra falta de soporte. No se usan valores antiguos de potencia. El análisis COP comprueba además el emparejamiento y el estado de funcionamiento.",
    "I valori di potenza provengono esclusivamente dai dati aggiuntivi HeishaMon (extra). Senza messaggi validi rimangono sconosciuti; l’assenza di dati non dimostra la mancanza di supporto. Nessun ricorso ai vecchi valori di potenza. L’analisi COP separata verifica anche l’abbinamento e lo stato operativo.",
    "Os valores de potência provêm exclusivamente dos dados adicionais do HeishaMon (extra). Sem mensagens válidas, permanecem desconhecidos; a ausência de dados não comprova falta de suporte. Não são usados valores de potência antigos como alternativa. A análise separada do COP verifica também o emparelhamento e o estado de funcionamento."
  ],
  "Gespeicherte Ereignisse": [
    "Stored events",
    "Événements enregistrés",
    "Eventos guardados",
    "Eventi salvati",
    "Eventos guardados"
  ],
  "Letzte Ereignisse": [
    "Recent events",
    "Événements récents",
    "Eventos recientes",
    "Ultimi eventi",
    "Últimos eventos"
  ],
  "Ereignisse": [
    "Events",
    "Événements",
    "Eventos",
    "Eventi",
    "Eventos"
  ],
  "Art": [
    "Type",
    "Type",
    "Tipo",
    "Tipo",
    "Tipo"
  ],
  "Ereignisart": [
    "Event type",
    "Type d’événement",
    "Tipo de evento",
    "Tipo di evento",
    "Tipo de evento"
  ],
  "Alle": [
    "All",
    "Tous",
    "Todos",
    "Tutti",
    "Todos"
  ],
  "Ereignisse werden geladen …": [
    "Loading events …",
    "Chargement des événements…",
    "Cargando eventos…",
    "Caricamento degli eventi …",
    "A carregar eventos …"
  ],
  "Noch keine gespeicherten Ereignisse.": [
    "No stored events yet.",
    "Aucun événement enregistré pour le moment.",
    "Todavía no hay eventos guardados.",
    "Nessun evento ancora salvato.",
    "Ainda não existem eventos guardados."
  ],
  "Simulation": [
    "Simulation",
    "Simulation",
    "Simulación",
    "Simulazione",
    "Simulação"
  ],
  "Ältere Ereignisse laden": [
    "Load older events",
    "Charger les événements précédents",
    "Cargar eventos anteriores",
    "Carica eventi precedenti",
    "Carregar eventos anteriores"
  ],
  "Sterilisation – Status": [
    "Sterilisation – Status",
    "Stérilisation – État",
    "Esterilización – Estado",
    "Sterilizzazione – Stato",
    "Esterilização – estado"
  ],
  "Sterilisationstemperatur": [
    "Sterilisation temperature",
    "Température de stérilisation",
    "Temperatura de esterilización",
    "Temperatura di sterilizzazione",
    "Temperatura de esterilização"
  ],
  "Sterilisation – maximale Dauer": [
    "Sterilisation – Maximum duration",
    "Stérilisation – Durée maximale",
    "Esterilización – Duración máxima",
    "Sterilizzazione – Durata massima",
    "Esterilização – duração máxima"
  ],
  "Außentemperatur": [
    "Outdoor temperature",
    "Température extérieure",
    "Temperatura exterior",
    "Temperatura esterna",
    "Temperatura exterior"
  ],
  "Verdichterfrequenz": [
    "Compressor frequency",
    "Fréquence du compresseur",
    "Frecuencia del compresor",
    "Frequenza del compressore",
    "Frequência do compressor"
  ],
  "Flüstermodus": [
    "Quiet mode",
    "Mode silencieux",
    "Modo silencioso",
    "Modalità silenziosa",
    "Modo silencioso"
  ],
  "Heizen": [
    "Heating",
    "Chauffage",
    "Calefacción",
    "Riscaldamento",
    "Aquecimento"
  ],
  "Kühlen": [
    "Cooling",
    "Refroidissement",
    "Refrigeración",
    "Raffrescamento",
    "Arrefecimento"
  ],
  "Auto (Heizen)": [
    "Auto (Heating)",
    "Auto (Chauffage)",
    "Auto (Calefacción)",
    "Auto (riscaldamento)",
    "Auto (Aquecimento)"
  ],
  "Heizen + Warmwasser": [
    "Heating + Hot water",
    "Chauffage + Eau chaude",
    "Calefacción + Agua caliente",
    "Riscaldamento + acqua calda",
    "Aquecimento + Água quente"
  ],
  "Kühlen + Warmwasser": [
    "Cooling + Hot water",
    "Refroidissement + Eau chaude",
    "Refrigeración + Agua caliente",
    "Raffrescamento + acqua calda",
    "Arrefecimento + Água quente"
  ],
  "Auto (Heizen) + Warmwasser": [
    "Auto (Heating) + Hot water",
    "Auto (Chauffage) + Eau chaude",
    "Auto (Calefacción) + Agua caliente",
    "Auto (riscaldamento) + acqua calda",
    "Auto (Aquecimento) + Água quente"
  ],
  "Auto (Kühlen)": [
    "Auto (Cooling)",
    "Auto (Refroidissement)",
    "Auto (Refrigeración)",
    "Auto (raffrescamento)",
    "Auto (Arrefecimento)"
  ],
  "Auto (Kühlen) + Warmwasser": [
    "Auto (Cooling) + Hot water",
    "Auto (Refroidissement) + Eau chaude",
    "Auto (Refrigeración) + Agua caliente",
    "Auto (raffrescamento) + acqua calda",
    "Auto (Arrefecimento) + Água quente"
  ],
  "Übersicht": [
    "Overview",
    "Vue d’ensemble",
    "Resumen",
    "Panoramica",
    "Visão geral"
  ],
  "Verlauf": [
    "History",
    "Historique",
    "Historial",
    "Storico",
    "Histórico"
  ],
  "Steuerung": [
    "Controls",
    "Commande",
    "Control",
    "Controllo",
    "Controlo"
  ],
  "Einstellungen": [
    "Settings",
    "Paramètres",
    "Ajustes",
    "Impostazioni",
    "Definições"
  ],
  "Umdrehungen pro Minute": [
    "Revolutions per minute",
    "Tours par minute",
    "Revoluciones por minuto",
    "Giri al minuto",
    "Rotações por minuto"
  ],
  "Ampere": [
    "Amperes",
    "Ampères",
    "Amperios",
    "Ampere",
    "Ampere"
  ],
  "Kilogramm-Kraft pro Quadratzentimeter": [
    "Kilogram-force per square centimetre",
    "Kilogramme-force par centimètre carré",
    "Kilogramo-fuerza por centímetro cuadrado",
    "Chilogrammi forza per centimetro quadrato",
    "Quilograma-força por centímetro quadrado"
  ],
  "Fehlerstatus unbekannt": [
    "Fault status unknown",
    "État des défauts inconnu",
    "Estado de fallos desconocido",
    "Stato di errore sconosciuto",
    "Estado de erro desconhecido"
  ],
  "Fehlerfrei": [
    "No fault",
    "Aucun défaut",
    "Sin fallos",
    "Nessun errore",
    "Sem erros"
  ],
  "Inaktiv": [
    "Inactive",
    "Inactif",
    "Inactivo",
    "Inattivo",
    "Inativo"
  ],
  "Aktiv": [
    "Active",
    "Actif",
    "Activo",
    "Attivo",
    "Ativo"
  ],
  "Raumheizung": [
    "Space heating",
    "Chauffage ambiant",
    "Calefacción ambiente",
    "Riscaldamento ambienti",
    "Aquecimento ambiente"
  ],
  "Festwert": [
    "Fixed setpoint",
    "Consigne fixe",
    "Consigna fija",
    "Valore fisso",
    "Valor fixo"
  ],
  "Aus": [
    "Off",
    "Arrêt",
    "Apagado",
    "Spento",
    "Desligado"
  ],
  "Stufe 1": [
    "Level 1",
    "Niveau 1",
    "Nivel 1",
    "Livello 1",
    "Nível 1"
  ],
  "Stufe 2": [
    "Level 2",
    "Niveau 2",
    "Nivel 2",
    "Livello 2",
    "Nível 2"
  ],
  "Stufe 3": [
    "Level 3",
    "Niveau 3",
    "Nivel 3",
    "Livello 3",
    "Nível 3"
  ],
  "Ein": [
    "On",
    "Marche",
    "Encendido",
    "Acceso",
    "Ligado"
  ],
  "Noch nicht verfügbar": [
    "Not yet available",
    "Pas encore disponible",
    "Todavía no disponible",
    "Non ancora disponibile",
    "Ainda indisponível"
  ],
  "Empfangen": [
    "Received",
    "Reçu",
    "Recibido",
    "Ricevuto",
    "Recebido"
  ],
  "Noch kein Messwert": [
    "No reading yet",
    "Aucune mesure reçue",
    "Todavía sin mediciones",
    "Nessun valore ancora misurato",
    "Ainda sem medição"
  ],
  "Retained · historische Nachricht": [
    "Retained · Historical message",
    "Retained · Message historique",
    "Retained · Mensaje histórico",
    "Retained · messaggio storico",
    "Retida · mensagem histórica"
  ],
  "{0} – Diagramm öffnen": [
    "{0} – Open chart",
    "{0} – Ouvrir le graphique",
    "{0} – Abrir gráfico",
    "{0} – Apri grafico",
    "{0} – Abrir gráfico"
  ],
  "Raumsollwert für Heizen, Zone 1. Nur bei bestätigter Raumregelung verfügbar.": [
    "Room heating setpoint, zone 1. Available only with confirmed room control.",
    "Consigne de chauffage ambiant, zone 1. Disponible uniquement avec une régulation d’ambiance confirmée.",
    "Consigna de calefacción ambiente, zona 1. Disponible solo con regulación ambiente confirmada.",
    "Setpoint ambiente per riscaldamento, zona 1. Disponibile solo con regolazione ambiente confermata.",
    "Temperatura ambiente definida para aquecimento, zona 1. Disponível apenas com regulação ambiente confirmada."
  ],
  "Temperatur und Dauer am Bedienteil einstellen. Den einmaligen Start unten in der Anlagensteuerung wählen. „Aktiv“ bestätigt keinen abgeschlossenen Zyklus.": [
    "Set temperature and duration on the controller. Select the one-off start below in system controls. “Active” does not confirm a completed cycle.",
    "Réglez température et durée sur le pupitre. Sélectionnez le démarrage unique ci-dessous dans la commande de l’installation. « Actif » ne confirme pas un cycle terminé.",
    "Ajusta temperatura y duración en el controlador. Selecciona el inicio único abajo en el control de la instalación. «Activo» no confirma un ciclo completo.",
    "Imposta temperatura e durata sul pannello di comando. Seleziona l’avvio singolo qui sotto nei controlli dell’impianto. «Attivo» non conferma un ciclo completato.",
    "Ajuste a temperatura e a duração no painel de controlo. Selecione o início único nos comandos da instalação abaixo. «Ativo» não confirma a conclusão de um ciclo."
  ],
  "Verbindungen und Datenqualität": [
    "Connections and data quality",
    "Connexions et qualité des données",
    "Conexiones y calidad de los datos",
    "Connessioni e qualità dei dati",
    "Ligações e qualidade dos dados"
  ],
  "Browser ↔ Backend": [
    "Browser ↔ Backend",
    "Navigateur ↔ Serveur",
    "Navegador ↔ Servidor",
    "Browser ↔ Backend",
    "Navegador ↔ Backend"
  ],
  "Verbunden": [
    "Connected",
    "Connecté",
    "Conectado",
    "Connesso",
    "Ligado"
  ],
  "Unterbrochen": [
    "Interrupted",
    "Interrompu",
    "Interrumpido",
    "Interrotto",
    "Interrompido"
  ],
  "Brokerverbindung": [
    "Broker connection",
    "Connexion au broker",
    "Conexión al bróker",
    "Connessione al broker",
    "Ligação ao broker"
  ],
  "Getrennt": [
    "Disconnected",
    "Déconnecté",
    "Desconectado",
    "Disconnesso",
    "Desligado"
  ],
  "Geräteverfügbarkeit (LWT)": [
    "Device availability (LWT)",
    "Disponibilité de l’appareil (LWT)",
    "Disponibilidad del dispositivo (LWT)",
    "Disponibilità del dispositivo (LWT)",
    "Disponibilidade do dispositivo (LWT)"
  ],
  "Online": [
    "Online",
    "En ligne",
    "En línea",
    "Online",
    "Online"
  ],
  "Offline": [
    "Offline",
    "Hors ligne",
    "Sin conexión",
    "Offline",
    "Offline"
  ],
  "Zum Inhalt": [
    "Skip to content",
    "Aller au contenu",
    "Saltar al contenido",
    "Vai al contenuto",
    "Ir para o conteúdo"
  ],
  "Betriebsart unbekannt": [
    "Operating mode unknown",
    "Mode de fonctionnement inconnu",
    "Modo de funcionamiento desconocido",
    "Modalità operativa sconosciuta",
    "Modo de funcionamento desconhecido"
  ],
  "HeishaMon online": [
    "HeishaMon online",
    "HeishaMon en ligne",
    "HeishaMon en línea",
    "HeishaMon online",
    "HeishaMon online"
  ],
  "Verbindungsstatus simuliert": [
    "Simulated connection status",
    "État de connexion simulé",
    "Estado de conexión simulado",
    "Stato della connessione simulato",
    "Estado da ligação simulado"
  ],
  "Verfügbarkeit laut LWT": [
    "Availability according to LWT",
    "Disponibilité selon LWT",
    "Disponibilidad según LWT",
    "Disponibilità secondo LWT",
    "Disponibilidade segundo LWT"
  ],
  "Stand ": [
    "Updated ",
    "Mis à jour ",
    "Actualizado ",
    "Aggiornato ",
    "Atualizado em "
  ],
  " · Berlin": [
    " · Berlin",
    " · Berlin",
    " · Berlín",
    " · Berlino",
    " · Berlim"
  ],
  "Warte auf Daten": [
    "Waiting for data",
    "En attente de données",
    "Esperando datos",
    "In attesa di dati",
    "A aguardar dados"
  ],
  "Anlagensteuerung": [
    "System controls",
    "Commande de l’installation",
    "Control de la instalación",
    "Controllo dell’impianto",
    "Controlo da instalação"
  ],
  "Heizkurvensteuerung": [
    "Heating curve control",
    "Commande de la courbe de chauffe",
    "Control de la curva de calefacción",
    "Controllo della curva climatica",
    "Controlo da curva de aquecimento"
  ],
  "Begrenzter Live-Test · reale Anlage": [
    "Limited live test · Real system",
    "Test réel limité · Installation réelle",
    "Prueba real limitada · Instalación real",
    "Test live limitato · impianto reale",
    "Teste em direto limitado · instalação real"
  ],
  "Simulatorsteuerung verfügbar": [
    "Simulator controls available",
    "Commande du simulateur disponible",
    "Control del simulador disponible",
    "Controllo del simulatore disponibile",
    "Controlo do simulador disponível"
  ],
  "Nur lesen": [
    "Read only",
    "Lecture seule",
    "Solo lectura",
    "Sola lettura",
    "Só leitura"
  ],
  "Hauptnavigation": [
    "Main navigation",
    "Navigation principale",
    "Navegación principal",
    "Navigazione principale",
    "Navegação principal"
  ],
  "Begrenzter Live-Test": [
    "Limited live test",
    "Test réel limité",
    "Prueba real limitada",
    "Test live limitato",
    "Teste em direto limitado"
  ],
  "Simulatorbetrieb": [
    "Simulator operation",
    "Fonctionnement du simulateur",
    "Funcionamiento del simulador",
    "Modalità simulatore",
    "Funcionamento do simulador"
  ],
  "Lesender Betrieb": [
    "Read-only operation",
    "Fonctionnement en lecture seule",
    "Funcionamiento de solo lectura",
    "Funzionamento in sola lettura",
    "Modo de leitura"
  ],
  "Diagramm wird geöffnet …": [
    "Opening chart …",
    "Ouverture du graphique…",
    "Abriendo gráfico…",
    "Apertura del grafico …",
    "A abrir o gráfico …"
  ],
  "Anordnung fertig": [
    "Finish arranging",
    "Terminer l’agencement",
    "Terminar de ordenar",
    "Ordinamento completato",
    "Concluir organização"
  ],
  "Kacheln anordnen": [
    "Arrange tiles",
    "Organiser les tuiles",
    "Ordenar tarjetas",
    "Ordina le schede",
    "Organizar cartões"
  ],
  "Version": [
    "Version",
    "Version",
    "Versión",
    "Versione",
    "Versão"
  ],
  "Simulatordaten": [
    "Simulated data",
    "Données simulées",
    "Datos simulados",
    "Dati simulati",
    "Dados simulados"
  ],
  "Lokaler Lesebetrieb": [
    "Local read-only operation",
    "Lecture seule locale",
    "Funcionamiento local de solo lectura",
    "Funzionamento locale in sola lettura",
    "Modo local de leitura"
  ],
  "Lokaler Bedienbetrieb": [
    "Local control operation",
    "Commande locale",
    "Funcionamiento de control local",
    "Controllo locale",
    "Modo local de controlo"
  ],
  "Datenquelle wird geladen …": [
    "Loading data source …",
    "Chargement de la source de données…",
    "Cargando origen de datos…",
    "Caricamento della sorgente dati …",
    "A carregar a fonte de dados …"
  ],
  "SIMULATION · Alle Messwerte und Verbindungszustände sind simuliert.": [
    "SIMULATION · All readings and connection states are simulated.",
    "SIMULATION · Toutes les mesures et tous les états de connexion sont simulés.",
    "SIMULACIÓN · Todas las mediciones y los estados de conexión son simulados.",
    "SIMULAZIONE · Tutte le misurazioni e gli stati di connessione sono simulati.",
    "SIMULAÇÃO · Todas as medições e estados de ligação são simulados."
  ],
  "MQTT · Heizkurve und Warmwassersteuerung verfügbar": [
    "MQTT · Heating curve and hot water controls available",
    "MQTT · Commandes de courbe de chauffe et d’eau chaude disponibles",
    "MQTT · Controles de curva de calefacción y agua caliente disponibles",
    "MQTT · Controllo della curva climatica e dell’acqua calda disponibile",
    "MQTT · Controlo da curva de aquecimento e da água quente disponível"
  ],
  "MQTT · Heizkurvensteuerung verfügbar": [
    "MQTT · Heating curve controls available",
    "MQTT · Commande de courbe de chauffe disponible",
    "MQTT · Control de curva de calefacción disponible",
    "MQTT · Controllo della curva climatica disponibile",
    "MQTT · Controlo da curva de aquecimento disponível"
  ],
  "MQTT · Lesender Betrieb": [
    "MQTT · Read-only operation",
    "MQTT · Lecture seule",
    "MQTT · Solo lectura",
    "MQTT · Sola lettura",
    "MQTT · Modo de leitura"
  ],
  "Liveverbindung zum Backend unterbrochen oder noch nicht hergestellt. Angezeigte Werte sind nicht aktuell.": [
    "Live connection to the backend interrupted or not yet established. Displayed readings are not current.",
    "Connexion au serveur interrompue ou pas encore établie. Les valeurs affichées ne sont pas à jour.",
    "Conexión en directo al servidor interrumpida o todavía no establecida. Los valores mostrados no están actualizados.",
    "Connessione in tempo reale al backend interrotta o non ancora stabilita. I valori visualizzati non sono aggiornati.",
    "Ligação em direto ao backend interrompida ou ainda não estabelecida. Os valores apresentados não estão atualizados."
  ],
  "Verbindungsausfall der Datenquelle. Letzte Werte sind veraltet.": [
    "Data source connection failed. Last readings are stale.",
    "Connexion à la source de données interrompue. Les dernières mesures sont périmées.",
    "Fallo de conexión con el origen de datos. Las últimas mediciones están desactualizadas.",
    "Connessione alla sorgente dati interrotta. Gli ultimi valori non sono aggiornati.",
    "Falha de ligação à fonte de dados. Os últimos valores estão desatualizados."
  ],
  "Reihenfolge wird in diesem Browser gespeichert. Am Griff ziehen oder dessen Pfeiltasten verwenden. Alternativ mit den Pfeilbuttons verschieben. Sortieren innerhalb der jeweiligen Gruppe; Escape bricht das Ziehen ab.": [
    "Order is saved in this browser. Drag the handle or use its arrow keys. Alternatively, use the arrow buttons. Sort within each group; Escape cancels dragging.",
    "L’ordre est enregistré dans ce navigateur. Faites glisser la poignée ou utilisez ses touches fléchées, ou les boutons fléchés. Tri au sein de chaque groupe ; Échap annule le déplacement.",
    "El orden se guarda en este navegador. Arrastra el asa o usa sus teclas de flecha, o los botones de flecha. Ordena dentro de cada grupo; Escape cancela el arrastre.",
    "L’ordine viene salvato in questo browser. Trascina la maniglia o usa i suoi tasti freccia. In alternativa, usa i pulsanti freccia. Ordinamento all’interno di ogni gruppo; Esc annulla il trascinamento.",
    "A ordem é guardada neste navegador. Arraste pela pega ou use as respetivas teclas de seta. Em alternativa, mova com os botões de seta. Ordenação dentro de cada grupo; Escape cancela o arrastamento."
  ],
  "Anlagenstatus": [
    "System status",
    "État de l’installation",
    "Estado de la instalación",
    "Stato dell’impianto",
    "Estado da instalação"
  ],
  "Anlagenmesswerte": [
    "System readings",
    "Mesures de l’installation",
    "Mediciones de la instalación",
    "Valori misurati dell’impianto",
    "Medições da instalação"
  ],
  "Steuerungsstatus": [
    "Control status",
    "État de la commande",
    "Estado del control",
    "Stato del controllo",
    "Estado do controlo"
  ],
  "Innen – nur lesen": [
    "Indoor – Read only",
    "Intérieur – Lecture seule",
    "Interior – Solo lectura",
    "Interno – sola lettura",
    "Interior – só leitura"
  ],
  "Dieses Release liest ausschließlich Messwerte. Heizungssteuerung benötigt eine separate Freigabe.": [
    "This release only reads measurements. Heating control requires separate authorisation.",
    "Cette version lit uniquement les mesures. La commande du chauffage nécessite une autorisation distincte.",
    "Esta versión solo lee mediciones. El control de calefacción requiere autorización independiente.",
    "Questa versione legge solo valori misurati. Il controllo del riscaldamento richiede un’autorizzazione separata.",
    "Esta versão apenas lê medições. O controlo do aquecimento exige autorização separada."
  ],
  "Online meldet die Erreichbarkeit von HeishaMon, nicht die Frische aller Wärmepumpenwerte. Datenalter ist das Empfangsalter; die Messzeit ist unbekannt.": [
    "Online indicates HeishaMon reachability, not the freshness of all heat pump readings. Data age is the time since reception; the measurement time is unknown.",
    "En ligne indique que HeishaMon est joignable, pas que toutes les mesures sont récentes. L’âge des données est le temps depuis leur réception ; l’heure de mesure est inconnue.",
    "En línea indica que HeishaMon está accesible, no que todas las mediciones sean recientes. La antigüedad es el tiempo desde la recepción; se desconoce la hora de medición.",
    "Online indica la raggiungibilità di HeishaMon, non l’aggiornamento di tutti i valori della pompa di calore. L’età dei dati è calcolata dalla ricezione; l’ora di misurazione è sconosciuta.",
    "Online indica que o HeishaMon está acessível, não que todos os valores da bomba de calor estejam atualizados. A idade dos dados é o tempo desde a receção; a hora da medição é desconhecida."
  ],
  "Einstellungen wurden inzwischen geändert. Bitte neu laden.": [
    "Settings have changed. Please reload.",
    "Les paramètres ont changé. Rechargez la page.",
    "Los ajustes han cambiado. Vuelve a cargarlos.",
    "Le impostazioni sono cambiate nel frattempo. Ricarica.",
    "As definições foram entretanto alteradas. Recarregue."
  ],
  "Name: 1–80 Zeichen. Aufbewahrung: 1–700 ganze Tage.": [
    "Name: 1–80 characters. Retention: 1–700 whole days.",
    "Nom : 1 à 80 caractères. Conservation : 1 à 700 jours entiers.",
    "Nombre: 1–80 caracteres. Conservación: 1–700 días enteros.",
    "Nome: 1–80 caratteri. Conservazione: 1–700 giorni interi.",
    "Nome: 1–80 caracteres. Retenção: 1–700 dias inteiros."
  ],
  "Bitte das spätere Löschen älterer Daten ausdrücklich bestätigen.": [
    "Please explicitly confirm the later deletion of older data.",
    "Confirmez explicitement la suppression ultérieure des anciennes données.",
    "Confirma expresamente la eliminación posterior de los datos antiguos.",
    "Conferma esplicitamente la successiva eliminazione dei dati più vecchi.",
    "Confirme explicitamente a eliminação posterior dos dados mais antigos."
  ],
  "Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.": [
    "Save failed. Previous settings are retained.",
    "Échec de l’enregistrement. Les paramètres précédents sont conservés.",
    "Error al guardar. Se conservan los ajustes anteriores.",
    "Salvataggio non riuscito. Le impostazioni precedenti vengono mantenute.",
    "Não foi possível guardar. As definições anteriores são mantidas."
  ],
  "Sitzung abgelaufen. Bitte neu anmelden.": [
    "Session expired. Please sign in again.",
    "Session expirée. Reconnectez-vous.",
    "La sesión ha caducado. Inicia sesión de nuevo.",
    "Sessione scaduta. Accedi di nuovo.",
    "A sessão expirou. Inicie sessão novamente."
  ],
  "Anmeldung erforderlich oder Zugangsdaten ungültig.": [
    "Sign-in required or invalid credentials.",
    "Connexion requise ou identifiants invalides.",
    "Se requiere iniciar sesión o las credenciales no son válidas.",
    "Accesso richiesto o credenziali non valide.",
    "É necessário iniciar sessão ou as credenciais são inválidas."
  ],
  "Zugang": [
    "Access",
    "Accès",
    "Acceso",
    "Accesso",
    "Acesso"
  ],
  "Einstellungen sind lesend. Die lokale Administration kann den Einstellungszugang separat aktivieren.": [
    "Settings are read only. Local administration can enable settings access separately.",
    "Les paramètres sont en lecture seule. L’administration locale peut activer séparément leur modification.",
    "Los ajustes son de solo lectura. La administración local puede habilitar su modificación por separado.",
    "Le impostazioni sono in sola lettura. L’amministrazione locale può abilitare separatamente l’accesso alle impostazioni.",
    "As definições são apenas de leitura. A administração local pode ativar separadamente o acesso às definições."
  ],
  "Einstellungen gespeichert. Eine geänderte Aufbewahrung gilt nach dem nächsten Cockpit-Neustart.": [
    "Settings saved. Changed retention takes effect after the next cockpit restart.",
    "Paramètres enregistrés. La nouvelle durée de conservation s’applique après le prochain redémarrage du tableau de bord.",
    "Ajustes guardados. La nueva conservación se aplica tras el próximo reinicio del panel.",
    "Impostazioni salvate. Una modifica alla conservazione avrà effetto dopo il prossimo riavvio del pannello.",
    "Definições guardadas. Uma alteração da retenção entra em vigor após o próximo reinício do painel."
  ],
  "Anlage & Datenspeicherung": [
    "System & Data storage",
    "Installation et stockage",
    "Instalación y almacenamiento",
    "Impianto e archiviazione dati",
    "Instalação e armazenamento de dados"
  ],
  "Anlagenname": [
    "System name",
    "Nom de l’installation",
    "Nombre de la instalación",
    "Nome dell’impianto",
    "Nome da instalação"
  ],
  "Aufbewahrung in Tagen": [
    "Retention in days",
    "Conservation en jours",
    "Conservación en días",
    "Conservazione in giorni",
    "Retenção em dias"
  ],
  "Aktiv:": [
    "Active:",
    "Actif :",
    "Activo:",
    "Attivo:",
    "Ativo:"
  ],
  "Tage · Messraster:": [
    "days · Sampling interval:",
    "jours · Intervalle d’échantillonnage :",
    "días · Intervalo de muestreo:",
    "giorni · Intervallo di campionamento:",
    "dias · Intervalo de medição:"
  ],
  "Sekunden. Ein anderes Messraster benötigt eine neue Datenbank.": [
    "seconds. A different sampling interval requires a new database.",
    "secondes. Un autre intervalle nécessite une nouvelle base de données.",
    "segundos. Otro intervalo requiere una nueva base de datos.",
    "secondi. Un intervallo diverso richiede un nuovo database.",
    "segundos. Um intervalo de medição diferente exige uma nova base de dados."
  ],
  "Geänderte Aufbewahrung gespeichert – Cockpit-Neustart ausstehend.": [
    "Changed retention saved – Cockpit restart pending.",
    "Nouvelle conservation enregistrée – Redémarrage en attente.",
    "Nueva conservación guardada – Reinicio del panel pendiente.",
    "Nuova conservazione salvata – riavvio del pannello in attesa.",
    "Alteração da retenção guardada – reinício do painel pendente."
  ],
  "Ich bestätige: Nach dem Neustart werden Messwerte und Ereignisse außerhalb der verkürzten Aufbewahrung gelöscht.": [
    "I confirm: after restart, readings and events outside the shortened retention period will be deleted.",
    "Je confirme : après redémarrage, les mesures et événements hors de la durée de conservation réduite seront supprimés.",
    "Confirmo: tras el reinicio se eliminarán las mediciones y eventos fuera del periodo de conservación reducido.",
    "Confermo: dopo il riavvio, i valori misurati e gli eventi oltre il periodo di conservazione ridotto verranno eliminati.",
    "Confirmo: após o reinício, as medições e os eventos fora do período de retenção reduzido serão eliminados."
  ],
  "Neu laden / Verwerfen": [
    "Reload / Discard",
    "Recharger / Abandonner",
    "Recargar / Descartar",
    "Ricarica / Scarta",
    "Recarregar / Descartar"
  ],
  "Einstellungen speichern": [
    "Save settings",
    "Enregistrer les paramètres",
    "Guardar ajustes",
    "Salva le impostazioni",
    "Guardar definições"
  ],
  "Datenquelle:": [
    "Data source:",
    "Source de données :",
    "Origen de datos:",
    "Sorgente dati:",
    "Fonte de dados:"
  ],
  "Simulator": [
    "Simulator",
    "Simulateur",
    "Simulador",
    "Simulatore",
    "Simulador"
  ],
  "Daten & Sicherung": [
    "Data & Backups",
    "Données et sauvegardes",
    "Datos y copias de seguridad",
    "Dati e backup",
    "Dados e cópias de segurança"
  ],
  "Verlauf / CSV-Export öffnen": [
    "Open history / CSV export",
    "Ouvrir l’historique / export CSV",
    "Abrir historial / exportación CSV",
    "Apri storico / esportazione CSV",
    "Abrir histórico / exportação CSV"
  ],
  "Zugriff & Sicherheit": [
    "Access & Security",
    "Accès et sécurité",
    "Acceso y seguridad",
    "Accesso e sicurezza",
    "Acesso e segurança"
  ],
  "Bediener-Anmeldung mit 30 Minuten Sitzungsdauer. Änderungen an Einstellungen benötigen Bedienerrechte.": [
    "Operator sign-in with a 30-minute session. Changing settings requires operator permissions.",
    "Connexion opérateur avec une session de 30 minutes. La modification des paramètres exige des droits opérateur.",
    "Acceso del operador con sesión de 30 minutos. Modificar ajustes requiere permisos de operador.",
    "Accesso operatore con sessione di 30 minuti. La modifica delle impostazioni richiede i permessi di operatore.",
    "Sessão de operador com duração de 30 minutos. As alterações às definições exigem permissões de operador."
  ],
  "Sterilisation einmalig starten": [
    "Start sterilisation once",
    "Démarrer une stérilisation unique",
    "Iniciar una esterilización",
    "Avvia una singola sterilizzazione",
    "Iniciar esterilização uma vez"
  ],
  "Innen-Soll (Heizen, Zone 1)": [
    "Indoor setpoint (heating, zone 1)",
    "Consigne intérieure (chauffage, zone 1)",
    "Consigna interior (calefacción, zona 1)",
    "Setpoint ambiente (riscaldamento, zona 1)",
    "Temperatura interior definida (aquecimento, zona 1)"
  ],
  "Auto": [
    "Auto",
    "Auto",
    "Auto",
    "Auto",
    "Auto"
  ],
  "Auto + Warmwasser": [
    "Auto + Hot water",
    "Auto + Eau chaude",
    "Auto + Agua caliente",
    "Auto + acqua calda",
    "Auto + Água quente"
  ],
  "Entwurf": [
    "Draft",
    "Brouillon",
    "Borrador",
    "Bozza",
    "Rascunho"
  ],
  "Geprüft – Bestätigung erforderlich": [
    "Checked – Confirmation required",
    "Vérifié – Confirmation requise",
    "Verificado – Requiere confirmación",
    "Verificato – conferma richiesta",
    "Verificado – confirmação necessária"
  ],
  "Simuliert gesendet – Rücklesen läuft": [
    "Simulated send – Reading back",
    "Envoi simulé – Relecture en cours",
    "Envío simulado – Leyendo retorno",
    "Invio simulato – rilettura in corso",
    "Envio simulado – leitura de retorno em curso"
  ],
  "Übereinstimmender Zustand beobachtet": [
    "Matching state observed",
    "État concordant observé",
    "Estado coincidente observado",
    "Stato corrispondente osservato",
    "Estado coincidente observado"
  ],
  "Zeitüberschreitung – kein passender Rücklesewert": [
    "Timed out – No matching readback",
    "Délai dépassé – Aucune relecture concordante",
    "Tiempo agotado – Sin lectura de retorno coincidente",
    "Tempo scaduto – nessun valore riletto corrispondente",
    "Tempo limite excedido – sem valor de retorno correspondente"
  ],
  "Dieser Parameter ist für den Live-Test gesperrt.": [
    "This parameter is blocked for the live test.",
    "Ce paramètre est bloqué pour le test réel.",
    "Este parámetro está bloqueado para la prueba real.",
    "Questo parametro è bloccato per il test live.",
    "Este parâmetro está bloqueado para o teste em direto."
  ],
  "Das Testfenster ist abgelaufen.": [
    "The test window has expired.",
    "La fenêtre de test a expiré.",
    "El periodo de prueba ha caducado.",
    "La finestra di test è scaduta.",
    "A janela de teste expirou."
  ],
  "Testfolge oder Sendebudget sperrt die Änderung.": [
    "The test sequence or send budget blocks the change.",
    "La séquence de test ou le quota d’envois bloque la modification.",
    "La secuencia de prueba o el límite de envíos bloquea el cambio.",
    "La sequenza di test o il limite di invii impedisce la modifica.",
    "A sequência de teste ou o limite de envios impede a alteração."
  ],
  "Wert außerhalb des erlaubten Bereichs.": [
    "Value outside the permitted range.",
    "Valeur hors de la plage autorisée.",
    "Valor fuera del rango permitido.",
    "Valore fuori dall’intervallo consentito.",
    "Valor fora do intervalo permitido."
  ],
  "Aktuelle, gültige Anlagenwerte und eine passende Sensorkonfiguration/Betriebsart sowie Fehlerfrei-Status erforderlich.": [
    "Current, valid system values, suitable sensor configuration/operating mode and a confirmed no-fault state are required.",
    "Des valeurs actuelles et valides, une configuration de capteur et un mode adaptés, ainsi qu’un état sans défaut confirmé sont requis.",
    "Se requieren valores actuales y válidos, configuración de sensor y modo adecuados, y un estado sin fallos confirmado.",
    "Sono necessari valori dell’impianto aggiornati e validi, una configurazione sensori/modalità operativa adeguata e uno stato senza errori.",
    "São necessários valores atuais e válidos da instalação, uma configuração de sensores/modo de funcionamento adequada e ausência de erros."
  ],
  "Der Zustand hat sich geändert. Bitte erneut prüfen.": [
    "The state has changed. Please check again.",
    "L’état a changé. Vérifiez à nouveau.",
    "El estado ha cambiado. Compruébalo de nuevo.",
    "Lo stato è cambiato. Ripeti la verifica.",
    "O estado mudou. Verifique novamente."
  ],
  "Es ist bereits ein Befehl offen.": [
    "A command is already pending.",
    "Une commande est déjà en cours.",
    "Ya hay una orden pendiente.",
    "Un comando è già in sospeso.",
    "Já existe um comando pendente."
  ],
  "Dieser Wert ist bereits eingestellt.": [
    "This value is already set.",
    "Cette valeur est déjà réglée.",
    "Este valor ya está ajustado.",
    "Questo valore è già impostato.",
    "Este valor já está definido."
  ],
  "Zwischen zwei Änderungen müssen mindestens 30 Sekunden liegen.": [
    "Allow at least 30 seconds between changes.",
    "Attendez au moins 30 secondes entre deux modifications.",
    "Deja al menos 30 segundos entre cambios.",
    "Devono trascorrere almeno 30 secondi tra due modifiche.",
    "Devem decorrer pelo menos 30 segundos entre duas alterações."
  ],
  "Entwurf abgelaufen. Bitte erneut prüfen.": [
    "Draft expired. Please check again.",
    "Brouillon expiré. Vérifiez à nouveau.",
    "Borrador caducado. Compruébalo de nuevo.",
    "Bozza scaduta. Ripeti la verifica.",
    "O rascunho expirou. Verifique novamente."
  ],
  "Sitzungsschutz abgelaufen. Bitte die Seite neu laden.": [
    "Session protection expired. Please reload the page.",
    "La protection de session a expiré. Rechargez la page.",
    "La protección de sesión ha caducado. Recarga la página.",
    "Protezione della sessione scaduta. Ricarica la pagina.",
    "A proteção da sessão expirou. Recarregue a página."
  ],
  "Befehlsprotokoll nicht verfügbar. Änderungen gesperrt.": [
    "Command log unavailable. Changes are blocked.",
    "Journal des commandes indisponible. Modifications bloquées.",
    "Registro de órdenes no disponible. Cambios bloqueados.",
    "Registro dei comandi non disponibile. Modifiche bloccate.",
    "Registo de comandos indisponível. Alterações bloqueadas."
  ],
  "Bitte die Änderung ausdrücklich bestätigen.": [
    "Please explicitly confirm the change.",
    "Confirmez explicitement la modification.",
    "Confirma expresamente el cambio.",
    "Conferma esplicitamente la modifica.",
    "Confirme explicitamente a alteração."
  ],
  "Nur der Ersteller darf diesen Entwurf bestätigen.": [
    "Only the creator may confirm this draft.",
    "Seul l’auteur peut confirmer ce brouillon.",
    "Solo el autor puede confirmar este borrador.",
    "Solo l’autore può confermare questa bozza.",
    "Apenas o autor pode confirmar este rascunho."
  ],
  "Diese Anfragekennung wurde bereits anders verwendet.": [
    "This request identifier has already been used differently.",
    "Cet identifiant de demande a déjà été utilisé autrement.",
    "Este identificador de solicitud ya se ha utilizado de otra forma.",
    "Questo identificativo di richiesta è già stato utilizzato in modo diverso.",
    "Este identificador de pedido já foi usado de outra forma."
  ],
  "MQTT-Sendeversuch protokolliert; keine Gerätebestätigung.": [
    "MQTT send attempt logged; no device confirmation.",
    "Tentative d’envoi MQTT journalisée ; aucune confirmation de l’appareil.",
    "Intento de envío MQTT registrado; sin confirmación del dispositivo.",
    "Tentativo di invio MQTT registrato; nessuna conferma del dispositivo.",
    "Tentativa de envio MQTT registada; não é uma confirmação do dispositivo."
  ],
  "Übertragung fehlgeschlagen oder ungewiss. Keine Wiederholung; Zustand am Bedienteil prüfen.": [
    "Transmission failed or uncertain. No retry; check the state on the controller.",
    "Transmission échouée ou incertaine. Aucun nouvel essai ; vérifiez l’état au pupitre.",
    "Transmisión fallida o incierta. Sin reintento; comprueba el estado en el controlador.",
    "Trasmissione non riuscita o incerta. Nessuna ripetizione; verifica lo stato sul pannello di comando.",
    "Transmissão falhada ou incerta. Sem repetição; verifique o estado no painel de controlo."
  ],
  "Nach Neustart abgebrochen; keine Wiederholung.": [
    "Cancelled after restart; no retry.",
    "Annulé après redémarrage ; aucun nouvel essai.",
    "Cancelado tras reinicio; sin reintento.",
    "Annullato dopo il riavvio; nessuna ripetizione.",
    "Cancelado após reinício; sem repetição."
  ],
  "Verbindung oder relevanter Zustand geändert.": [
    "Connection or relevant state changed.",
    "Connexion ou état pertinent modifié.",
    "Conexión o estado relevante modificado.",
    "Connessione o stato rilevante modificato.",
    "Ligação ou estado relevante alterado."
  ],
  "Entwurf abgelaufen oder Zustand geändert.": [
    "Draft expired or state changed.",
    "Brouillon expiré ou état modifié.",
    "Borrador caducado o estado modificado.",
    "Bozza scaduta o stato modificato.",
    "Rascunho expirado ou estado alterado."
  ],
  "Simulierter Übertragungsfehler.": [
    "Simulated transmission error.",
    "Erreur de transmission simulée.",
    "Error de transmisión simulado.",
    "Errore di trasmissione simulato.",
    "Erro de transmissão simulado."
  ],
  "Kein passender Rücklesewert innerhalb der Rücklesefrist.": [
    "No matching readback within the readback timeout.",
    "Aucune relecture concordante dans le délai imparti.",
    "Sin lectura de retorno coincidente dentro del plazo.",
    "Nessun valore riletto corrispondente entro il termine previsto.",
    "Nenhum valor de retorno correspondente dentro do prazo."
  ],
  "Sterilisation aktiv nach dem Senden beobachtet; der Zyklus ist damit nicht als abgeschlossen bestätigt.": [
    "Active sterilisation observed after sending; this does not confirm completion of the cycle.",
    "Stérilisation active observée après l’envoi ; cela ne confirme pas la fin du cycle.",
    "Esterilización activa observada tras el envío; esto no confirma que el ciclo haya terminado.",
    "Sterilizzazione attiva osservata dopo l’invio; ciò non conferma il completamento del ciclo.",
    "Esterilização ativa observada após o envio; isto não confirma a conclusão do ciclo."
  ],
  "Passender Wert nach dem Senden empfangen.": [
    "Matching value received after sending.",
    "Valeur concordante reçue après l’envoi.",
    "Valor coincidente recibido tras el envío.",
    "Valore corrispondente ricevuto dopo l’invio.",
    "Valor correspondente recebido após o envio."
  ],
  "An den internen Simulator übergeben.": [
    "Passed to the internal simulator.",
    "Transmis au simulateur interne.",
    "Transferido al simulador interno.",
    "Trasferito al simulatore interno.",
    "Entregue ao simulador interno."
  ],
  "Serverprüfung bestanden.": [
    "Server validation passed.",
    "Validation du serveur réussie.",
    "Validación del servidor superada.",
    "Verifica del server superata.",
    "Verificação do servidor concluída com sucesso."
  ],
  "Zustand vor Bestätigung geändert.": [
    "State changed before confirmation.",
    "État modifié avant confirmation.",
    "Estado modificado antes de confirmar.",
    "Stato modificato prima della conferma.",
    "Estado alterado antes da confirmação."
  ],
  "Simulatorsteuerung": [
    "Simulator controls",
    "Commande du simulateur",
    "Control del simulador",
    "Controllo del simulatore",
    "Controlo do simulador"
  ],
  "Sendeversuch protokolliert – Rücklesen läuft": [
    "Send attempt logged – Reading back",
    "Tentative d’envoi journalisée – Relecture en cours",
    "Intento de envío registrado – Leyendo retorno",
    "Tentativo di invio registrato – rilettura in corso",
    "Tentativa de envio registada – leitura de retorno em curso"
  ],
  "Anmeldung erforderlich oder Zugangsdaten falsch.": [
    "Sign-in required or incorrect credentials.",
    "Connexion requise ou identifiants incorrects.",
    "Se requiere iniciar sesión o las credenciales son incorrectas.",
    "Accesso richiesto o credenziali errate.",
    "É necessário iniciar sessão ou as credenciais estão incorretas."
  ],
  "Keine Berechtigung für diese Aktion.": [
    "You do not have permission for this action.",
    "Vous n’avez pas l’autorisation pour cette action.",
    "No tienes permiso para esta acción.",
    "Nessun permesso per questa azione.",
    "Sem permissão para esta ação."
  ],
  "Zu viele Anfragen. Bitte kurz warten.": [
    "Too many requests. Please wait briefly.",
    "Trop de demandes. Patientez un instant.",
    "Demasiadas solicitudes. Espera un momento.",
    "Troppe richieste. Attendi un momento.",
    "Demasiados pedidos. Aguarde um momento."
  ],
  "Anfrage fehlgeschlagen. Bitte erneut laden.": [
    "Request failed. Please reload.",
    "Échec de la demande. Rechargez.",
    "Error en la solicitud. Vuelve a cargar.",
    "Richiesta non riuscita. Ricarica.",
    "O pedido falhou. Recarregue."
  ],
  "REALE ANLAGE · Anlagensteuerung und einmaliger Sterilisationsstart. Änderungen werden erst nach Prüfung und ausdrücklicher Bestätigung gesendet.": [
    "REAL SYSTEM · System controls and one-off sterilisation start. Changes are sent only after checking and explicit confirmation.",
    "INSTALLATION RÉELLE · Commande et démarrage unique de stérilisation. Les modifications sont envoyées uniquement après vérification et confirmation explicite.",
    "INSTALACIÓN REAL · Control e inicio único de esterilización. Los cambios solo se envían tras verificarlos y confirmarlos expresamente.",
    "IMPIANTO REALE · Controllo dell’impianto e avvio singolo della sterilizzazione. Le modifiche vengono inviate solo dopo verifica e conferma esplicita.",
    "INSTALAÇÃO REAL · Controlo da instalação e início único de esterilização. As alterações só são enviadas após verificação e confirmação explícita."
  ],
  "REALE ANLAGE · Warmwasser-Soll 52 → 51 → 52 °C. Jede Änderung kann den Warmwasserbetrieb beeinflussen. TOP22 bleibt −8 K.": [
    "REAL SYSTEM · Hot water setpoint 52 → 51 → 52 °C. Each change may affect hot water operation. TOP22 remains −8 K.",
    "INSTALLATION RÉELLE · Consigne d’eau chaude 52 → 51 → 52 °C. Chaque modification peut influencer l’eau chaude. TOP22 reste à −8 K.",
    "INSTALACIÓN REAL · Consigna de agua caliente 52 → 51 → 52 °C. Cada cambio puede afectar al agua caliente. TOP22 permanece en −8 K.",
    "IMPIANTO REALE · Setpoint acqua calda 52 → 51 → 52 °C. Ogni modifica può influire sul funzionamento dell’acqua calda. TOP22 rimane a −8 K.",
    "INSTALAÇÃO REAL · Temperatura de água quente definida 52 → 51 → 52 °C. Cada alteração pode influenciar o funcionamento da água quente. TOP22 mantém-se em −8 K."
  ],
  "SIMULATION · Änderungen betreffen ausschließlich simulierte Werte.": [
    "SIMULATION · Changes affect simulated values only.",
    "SIMULATION · Les modifications concernent uniquement des valeurs simulées.",
    "SIMULACIÓN · Los cambios afectan únicamente a valores simulados.",
    "SIMULAZIONE · Le modifiche riguardano esclusivamente valori simulati.",
    "SIMULAÇÃO · As alterações afetam apenas valores simulados."
  ],
  "Verbleibende Sendeversuche:": [
    "Remaining send attempts:",
    "Tentatives d’envoi restantes :",
    "Intentos de envío restantes:",
    "Tentativi di invio rimanenti:",
    "Tentativas de envio restantes:"
  ],
  ". Testende:": [
    ". Test ends:",
    ". Fin du test :",
    ". Fin de la prueba:",
    ". Fine del test:",
    ". Fim do teste:"
  ],
  " (Berlin)": [
    " (Berlin)",
    " (Berlin)",
    " (Berlín)",
    " (Berlino)",
    " (Berlim)"
  ],
  ". Keine automatische Rücksetzung.": [
    ". No automatic reset.",
    ". Aucune remise à l’état initial automatique.",
    ". Sin restablecimiento automático.",
    ". Nessun ripristino automatico.",
    ". Sem reposição automática."
  ],
  "Sitzung erneuert. Bitte erneut anmelden.": [
    "Session renewed. Please sign in again.",
    "Session renouvelée. Reconnectez-vous.",
    "Sesión renovada. Inicia sesión de nuevo.",
    "Sessione rinnovata. Accedi di nuovo.",
    "Sessão renovada. Inicie sessão novamente."
  ],
  "Betrachter (nur lesen)": [
    "Viewer (read only)",
    "Observateur (lecture seule)",
    "Observador (solo lectura)",
    "Osservatore (sola lettura)",
    "Observador (só leitura)"
  ],
  "Aktuell:": [
    "Current:",
    "Actuel :",
    "Actual:",
    "Attuale:",
    "Atual:"
  ],
  "Negative Einschaltdifferenz zum Warmwasser-Sollwert; von −12 bis −2 K.": [
    "Negative start differential relative to the hot water setpoint; from −12 to −2 K.",
    "Différentiel de démarrage négatif par rapport à la consigne d’eau chaude ; de −12 à −2 K.",
    "Diferencial de arranque negativo respecto a la consigna de agua caliente; de −12 a −2 K.",
    "Differenziale di accensione negativo rispetto al setpoint acqua calda; da −12 a −2 K.",
    "Diferencial de arranque negativo em relação à temperatura de água quente definida; de −12 a −2 K."
  ],
  "Gewünschter Wert (": [
    "Desired value (",
    "Valeur souhaitée (",
    "Valor deseado (",
    "Valore desiderato (",
    "Valor pretendido ("
  ],
  "Gewünschter Wert": [
    "Desired value",
    "Valeur souhaitée",
    "Valor deseado",
    "Valore desiderato",
    "Valor pretendido"
  ],
  "Bitte wählen": [
    "Please select",
    "Sélectionner",
    "Seleccionar",
    "Seleziona",
    "Selecione"
  ],
  "Raumsollwert für Heizen, Zone 1: 16–28 °C. Nur bei aktueller, bestätigter Raumregelung und aktiver Zone 1 im Heizbetrieb verfügbar.": [
    "Room heating setpoint, zone 1: 16–28 °C. Available only with current, confirmed room control and active zone 1 in heating mode.",
    "Consigne d’ambiance, zone 1 : 16–28 °C. Disponible uniquement avec une régulation d’ambiance actuelle et confirmée et la zone 1 active en chauffage.",
    "Consigna ambiente, zona 1: 16–28 °C. Disponible solo con regulación ambiente actual y confirmada y zona 1 activa en calefacción.",
    "Setpoint ambiente per riscaldamento, zona 1: 16–28 °C. Disponibile solo con regolazione ambiente aggiornata e confermata e zona 1 attiva in riscaldamento.",
    "Temperatura ambiente definida para aquecimento, zona 1: 16–28 °C. Disponível apenas com regulação ambiente atual e confirmada e zona 1 ativa em aquecimento."
  ],
  "Aus oder Stufe 1–3; höhere Stufen begrenzen die Leistung stärker.": [
    "Off or level 1–3; higher levels limit output more strongly.",
    "Arrêt ou niveaux 1 à 3 ; les niveaux supérieurs limitent davantage la puissance.",
    "Apagado o niveles 1–3; los niveles superiores limitan más la potencia.",
    "Spento o livello 1–3; i livelli più alti limitano maggiormente la potenza.",
    "Desligado ou nível 1–3; os níveis superiores limitam mais a potência."
  ],
  "Kühlen und Auto benötigen die Freischaltung am Bedienteil. HeishaMon 4.2.0 bietet dafür keinen eigenen Freischaltbefehl. Auto kann zwischen Heizen und Kühlen wechseln.": [
    "Cooling and Auto require enabling on the controller. HeishaMon 4.2.0 has no dedicated enabling command. Auto may switch between heating and cooling.",
    "Refroidissement et Auto nécessitent une activation au pupitre. HeishaMon 4.2.0 ne propose pas de commande d’activation dédiée. Auto peut alterner chauffage et refroidissement.",
    "Refrigeración y Auto requieren habilitación en el controlador. HeishaMon 4.2.0 no dispone de una orden específica para habilitarlos. Auto puede alternar entre calefacción y refrigeración.",
    "Raffrescamento e Auto richiedono l’abilitazione sul pannello di comando. HeishaMon 4.2.0 non offre un comando specifico per abilitarli. Auto può alternare riscaldamento e raffrescamento.",
    "Arrefecimento e Auto exigem ativação no painel de controlo. O HeishaMon 4.2.0 não disponibiliza um comando específico para esta ativação. Auto pode alternar entre aquecimento e arrefecimento."
  ],
  "Einmaliger Start mit den am Bedienteil eingestellten Werten. Dabei wird das Warmwasser stark erhitzt. Keine automatische Wiederholung; Aktivstatus ist kein Nachweis eines abgeschlossenen Zyklus.": [
    "One-off start using the controller settings. Hot water is heated to a high temperature. No automatic repeat; active status does not prove a completed cycle.",
    "Démarrage unique avec les réglages du pupitre. L’eau chaude est fortement chauffée. Aucune répétition automatique ; l’état actif ne prouve pas un cycle terminé.",
    "Inicio único con los ajustes del controlador. El agua se calienta a alta temperatura. Sin repetición automática; el estado activo no demuestra un ciclo completo.",
    "Avvio singolo con i valori impostati sul pannello di comando. L’acqua calda viene riscaldata a temperatura elevata. Nessuna ripetizione automatica; lo stato attivo non dimostra il completamento del ciclo.",
    "Início único com os valores definidos no painel de controlo. A água quente é aquecida a uma temperatura elevada. Sem repetição automática; o estado ativo não comprova a conclusão de um ciclo."
  ],
  "Einstellbereich": [
    "Setting range",
    "Plage de réglage",
    "Rango de ajuste",
    "Intervallo di impostazione",
    "Intervalo de ajuste"
  ],
  "Testbereich": [
    "Test range",
    "Plage de test",
    "Rango de prueba",
    "Intervallo di test",
    "Intervalo de teste"
  ],
  "Simulatorbereich": [
    "Simulator range",
    "Plage du simulateur",
    "Rango del simulador",
    "Intervallo del simulatore",
    "Intervalo do simulador"
  ],
  "Am Bedienteil abgleichen; während einer Änderung keine parallelen Änderungen über Cloud oder Bedienteil.": [
    "Verify on the controller; do not make parallel changes through the cloud or controller during a change.",
    "Vérifiez au pupitre ; ne faites aucune modification parallèle via le cloud ou le pupitre pendant une modification.",
    "Comprueba en el controlador; no realices cambios paralelos mediante la nube o el controlador durante un cambio.",
    "Confronta con il pannello di comando; durante una modifica, non effettuare modifiche parallele tramite cloud o pannello.",
    "Compare com o painel de controlo; durante uma alteração, não efetue alterações em paralelo através da cloud ou do painel de controlo."
  ],
  "Keine Freigabe für eine reale Anlage.": [
    "Not authorised for a real system.",
    "Aucune autorisation pour une installation réelle.",
    "Sin autorización para una instalación real.",
    "Nessuna autorizzazione per un impianto reale.",
    "Sem autorização para uma instalação real."
  ],
  "Änderungen gesperrt: erforderliche aktuelle Werte oder Befehlsprotokoll nicht verfügbar.": [
    "Changes blocked: required current values or command log unavailable.",
    "Modifications bloquées : valeurs actuelles requises ou journal des commandes indisponibles.",
    "Cambios bloqueados: valores actuales requeridos o registro de órdenes no disponibles.",
    "Modifiche bloccate: valori aggiornati necessari o registro dei comandi non disponibili.",
    "Alterações bloqueadas: valores atuais necessários ou registo de comandos indisponíveis."
  ],
  "Änderung prüfen": [
    "Check change",
    "Vérifier la modification",
    "Verificar cambio",
    "Verifica la modifica",
    "Verificar alteração"
  ],
  "Änderung bestätigen": [
    "Confirm change",
    "Confirmer la modification",
    "Confirmar cambio",
    "Conferma la modifica",
    "Confirmar alteração"
  ],
  "Inaktiv → Start anfordern": [
    "Inactive → Request start",
    "Inactif → Demander le démarrage",
    "Inactivo → Solicitar inicio",
    "Inattivo → Richiedi avvio",
    "Inativo → Solicitar início"
  ],
  "· erstellt von": [
    "· Created by",
    "· Créé par",
    "· Creado por",
    "· creato da",
    "· criado por"
  ],
  "Ich bestätige diese Änderung an der realen Wärmepumpe.": [
    "I confirm this change to the real heat pump.",
    "Je confirme cette modification de la pompe à chaleur réelle.",
    "Confirmo este cambio en la bomba de calor real.",
    "Confermo questa modifica sulla pompa di calore reale.",
    "Confirmo esta alteração na bomba de calor real."
  ],
  "Ich bestätige diese Änderung im Simulator.": [
    "I confirm this change in the simulator.",
    "Je confirme cette modification dans le simulateur.",
    "Confirmo este cambio en el simulador.",
    "Confermo questa modifica nel simulatore.",
    "Confirmo esta alteração no simulador."
  ],
  "Jetzt an Wärmepumpe senden": [
    "Send to heat pump now",
    "Envoyer à la pompe à chaleur",
    "Enviar ahora a la bomba de calor",
    "Invia ora alla pompa di calore",
    "Enviar agora para a bomba de calor"
  ],
  "Jetzt im Simulator bestätigen": [
    "Confirm in simulator now",
    "Confirmer dans le simulateur",
    "Confirmar ahora en el simulador",
    "Conferma ora nel simulatore",
    "Confirmar agora no simulador"
  ],
  "Verwerfen": [
    "Discard",
    "Abandonner",
    "Descartar",
    "Scarta",
    "Descartar"
  ],
  "Rücklesen frühestens nach 10 Sekunden; Timeout nach": [
    "Readback no earlier than 10 seconds; timeout after",
    "Relecture au plus tôt après 10 secondes ; expiration après",
    "Lectura de retorno no antes de 10 segundos; tiempo límite de",
    "Rilettura non prima di 10 secondi; timeout dopo",
    "Leitura de retorno após pelo menos 10 segundos; tempo limite após"
  ],
  "Sekunden. Keine automatische Wiederholung.": [
    "seconds. No automatic retry.",
    "secondes. Aucun nouvel essai automatique.",
    "segundos. Sin reintento automático.",
    "secondi. Nessuna ripetizione automatica.",
    "segundos. Sem repetição automática."
  ],
  "Befehlsprotokoll (": [
    "Command log (",
    "Journal des commandes (",
    "Registro de órdenes (",
    "Registro dei comandi (",
    "Registo de comandos ("
  ],
  "MQTT · reale Anlage": [
    "MQTT · Real system",
    "MQTT · Installation réelle",
    "MQTT · Instalación real",
    "MQTT · impianto reale",
    "MQTT · instalação real"
  ],
  "Ein übereinstimmender Rücklesewert ist keine kausale Gerätebestätigung.": [
    "A matching readback is not a causal device confirmation.",
    "Une relecture concordante n’est pas une confirmation causale de l’appareil.",
    "Una lectura de retorno coincidente no es una confirmación causal del dispositivo.",
    "Un valore riletto corrispondente non è una conferma causale del dispositivo.",
    "Um valor de retorno coincidente não é uma confirmação causal do dispositivo."
  ],
  "· Rücklesewert:": [
    "· Readback:",
    "· Valeur relue :",
    "· Lectura de retorno:",
    "· Valore riletto:",
    "· Valor de retorno:"
  ],
  "Noch keine": [
    "None yet:",
    "Aucun pour le moment :",
    "Todavía no hay:",
    "Ancora nessun",
    "Ainda sem"
  ],
  "Live-Befehle": [
    "live commands",
    "commandes réelles",
    "órdenes reales",
    "comando live",
    "comandos em direto"
  ],
  "Simulatorbefehle": [
    "simulator commands",
    "commandes du simulateur",
    "órdenes del simulador",
    "comando del simulatore",
    "comandos do simulador"
  ],
  "Reihenfolge nur für diese Sitzung geändert: Der Browser konnte sie nicht dauerhaft speichern.": [
    "Order changed for this session only: the browser could not save it permanently.",
    "Ordre modifié pour cette session uniquement : le navigateur n’a pas pu l’enregistrer durablement.",
    "Orden modificado solo para esta sesión: el navegador no pudo guardarlo de forma permanente.",
    "Ordine modificato solo per questa sessione: il browser non ha potuto salvarlo in modo permanente.",
    "Ordem alterada apenas para esta sessão: o navegador não conseguiu guardá-la permanentemente."
  ],
  " auf Position ": [
    " at position ",
    " à la position ",
    " en la posición ",
    " alla posizione ",
    " na posição "
  ],
  " nach vorne": [
    " move earlier",
    " déplacer avant",
    " mover antes",
    " avanti",
    " para a frente"
  ],
  " nach hinten": [
    " move later",
    " déplacer après",
    " mover después",
    " indietro",
    " para trás"
  ],
  "Design gilt nur für diese Sitzung: Browserspeicher nicht verfügbar.": [
    "Theme applies to this session only: browser storage unavailable.",
    "Le thème s’applique uniquement à cette session : stockage du navigateur indisponible.",
    "El tema se aplica solo a esta sesión: almacenamiento del navegador no disponible.",
    "Il tema vale solo per questa sessione: memoria del browser non disponibile.",
    "O tema aplica-se apenas a esta sessão: armazenamento do navegador indisponível."
  ],
  "Darstellung": [
    "Appearance",
    "Apparence",
    "Apariencia",
    "Aspetto",
    "Aspeto"
  ],
  "Hell": [
    "Light",
    "Clair",
    "Claro",
    "Chiaro",
    "Claro"
  ],
  "Dunkel": [
    "Dark",
    "Sombre",
    "Oscuro",
    "Scuro",
    "Escuro"
  ],
  "Nordisch": [
    "Nordic",
    "Nordique",
    "Nórdico",
    "Nordico",
    "Nórdico"
  ],
  "Zeitlich geprüftes Spreizungsband": [
    "Time-validated temperature difference band",
    "Bande d’écart validée temporellement",
    "Banda de diferencia validada temporalmente",
    "Banda della differenza di temperatura con verifica temporale",
    "Banda da diferença de temperatura verificada temporalmente"
  ],
  "Gepaarter Vorlauf": [
    "Paired flow",
    "Départ apparié",
    "Impulsión emparejada",
    "Mandata abbinata",
    "Ida emparelhada"
  ],
  "Gepaarter Rücklauf": [
    "Paired return",
    "Retour apparié",
    "Retorno emparejado",
    "Ritorno abbinato",
    "Retorno emparelhado"
  ],
  "Sterilisation aktiv beobachtet": [
    "Active sterilisation observed",
    "Stérilisation active observée",
    "Esterilización activa observada",
    "Sterilizzazione attiva osservata",
    "Esterilização ativa observada"
  ],
  "Sterilisation inaktiv beobachtet": [
    "Inactive sterilisation observed",
    "Stérilisation inactive observée",
    "Esterilización inactiva observada",
    "Sterilizzazione inattiva osservata",
    "Esterilização inativa observada"
  ],
  "Gepaarte Spreizung: {0} · {1}/{2} Paare": [
    "Paired temperature difference: {0} · {1}/{2} pairs",
    "Écart apparié : {0} · {1}/{2} paires",
    "Diferencia emparejada: {0} · {1}/{2} pares",
    "Differenza di temperatura abbinata: {0} · {1}/{2} coppie",
    "Diferença de temperatura emparelhada: {0} · {1}/{2} pares"
  ],
  "Vollständig": [
    "Complete",
    "Complet",
    "Completo",
    "Completo",
    "Completo"
  ],
  "Unvollständig": [
    "Incomplete",
    "Incomplet",
    "Incompleto",
    "Incompleto",
    "Incompleto"
  ],
  "Keine Daten": [
    "No data",
    "Aucune donnée",
    "Sin datos",
    "Nessun dato",
    "Sem dados"
  ],
  "Laufender Tag": [
    "Current day",
    "Journée en cours",
    "Día en curso",
    "Giorno in corso",
    "Dia em curso"
  ],
  "Zukünftig": [
    "Future",
    "À venir",
    "Futuro",
    "Futuro",
    "Futuro"
  ],
  "Keine erfasste Energie": [
    "No recorded energy",
    "Aucune énergie enregistrée",
    "Sin energía registrada",
    "Nessuna energia registrata",
    "Sem energia registada"
  ],
  " kWh erfasst": [
    " kWh recorded",
    " kWh enregistrés",
    " kWh registrados",
    " kWh registrati",
    " kWh registados"
  ],
  "Jan": [
    "Jan",
    "janv.",
    "ene",
    "Gen",
    "Jan"
  ],
  "Feb": [
    "Feb",
    "févr.",
    "feb",
    "Feb",
    "Fev"
  ],
  "Mär": [
    "Mar",
    "mars",
    "mar",
    "Mar",
    "Mar"
  ],
  "Apr": [
    "Apr",
    "avr.",
    "abr",
    "Apr",
    "Abr"
  ],
  "Mai": [
    "May",
    "mai",
    "may",
    "Mag",
    "Mai"
  ],
  "Jun": [
    "Jun",
    "juin",
    "jun",
    "Giu",
    "Jun"
  ],
  "Jul": [
    "Jul",
    "juil.",
    "jul",
    "Lug",
    "Jul"
  ],
  "Aug": [
    "Aug",
    "août",
    "ago",
    "Ago",
    "Ago"
  ],
  "Sep": [
    "Sep",
    "sept.",
    "sep",
    "Set",
    "Set"
  ],
  "Okt": [
    "Oct",
    "oct.",
    "oct",
    "Ott",
    "Out"
  ],
  "Nov": [
    "Nov",
    "nov.",
    "nov",
    "Nov",
    "Nov"
  ],
  "Dez": [
    "Dec",
    "déc.",
    "dic",
    "Dic",
    "Dez"
  ],
  "So": [
    "Sun",
    "dim.",
    "dom",
    "Dom",
    "Dom"
  ],
  "Mo": [
    "Mon",
    "lun.",
    "lun",
    "Lun",
    "Seg"
  ],
  "Di": [
    "Tue",
    "mar.",
    "mar",
    "Mar",
    "Ter"
  ],
  "Mi": [
    "Wed",
    "mer.",
    "mié",
    "Mer",
    "Qua"
  ],
  "Do": [
    "Thu",
    "jeu.",
    "jue",
    "Gio",
    "Qui"
  ],
  "Fr": [
    "Fri",
    "ven.",
    "vie",
    "Ven",
    "Sex"
  ],
  "Sa": [
    "Sat",
    "sam.",
    "sáb",
    "Sab",
    "Sáb"
  ],
  "Auswertung nicht verfügbar.": [
    "Analysis unavailable.",
    "Analyse indisponible.",
    "Análisis no disponible.",
    "Analisi non disponibile.",
    "Análise indisponível."
  ],
  "Für COP bitte auf höchstens 31 Tage zoomen.": [
    "For COP, zoom to a maximum of 31 days.",
    "Pour le COP, zoomez sur 31 jours maximum.",
    "Para el COP, limita el periodo a un máximo de 31 días.",
    "Per il COP, limita lo zoom a un massimo di 31 giorni.",
    "Para o COP, reduza o período para no máximo 31 dias."
  ],
  "Effizienz und Tagesenergie": [
    "Efficiency and daily energy",
    "Efficacité et énergie quotidienne",
    "Eficiencia y energía diaria",
    "Efficienza ed energia giornaliera",
    "Eficiência e energia diária"
  ],
  "COP · Heizen und Warmwasser": [
    "COP · Heating and hot water",
    "COP · Chauffage et eau chaude",
    "COP · Calefacción y agua caliente",
    "COP · Riscaldamento e acqua calda",
    "COP · Aquecimento e água quente"
  ],
  "Gleitender Mittelwert": [
    "Moving average",
    "Moyenne glissante",
    "Media móvil",
    "Media mobile",
    "Média móvel"
  ],
  "Minuten": [
    "minutes",
    "minutes",
    "minutos",
    "Minuti",
    "minutos"
  ],
  "COP = thermische Extra-Leistung /": [
    "COP = Extra thermal power /",
    "COP = Puissance thermique Extra /",
    "COP = Potencia térmica Extra /",
    "COP = potenza termica extra /",
    "COP = potência térmica extra /"
  ],
  
  "elektrische Extra-Leistung": [
    "Extra electrical power",
    "Puissance électrique Extra",
    "Potencia eléctrica Extra",
    "potenza elettrica extra",
    "potência elétrica extra"
  ],
  ". Blau: Heizen; Violett: Warmwasser. Gestrichelt: Rastermittel des COP; durchgezogen: nachlaufender zeitgewichteter Mittelwert. Lücken, Abtauung, Heizstab und Betriebswechsel unterbrechen die Glättung. Kühlen ist kein Heiz-COP.": [
    ". Blue: heating; purple: hot water. Dashed: COP bucket average; solid: trailing time-weighted average. Gaps, defrosting, backup heating and mode changes interrupt smoothing. Cooling is not heating COP.",
    ". Bleu : chauffage ; violet : eau chaude. Pointillés : moyenne du COP par intervalle ; trait plein : moyenne temporelle pondérée rétrospective. Lacunes, dégivrage, résistance et changements de mode interrompent le lissage. Le refroidissement n’est pas un COP de chauffage.",
    ". Azul: calefacción; violeta: agua caliente. Discontinua: media del COP por intervalo; continua: media móvil ponderada en el tiempo. Las lagunas, el desescarche, la resistencia y los cambios de modo interrumpen el suavizado. La refrigeración no es COP de calefacción.",
    ". Blu: riscaldamento; viola: acqua calda. Tratteggiato: media del COP per intervallo; continuo: media mobile ponderata nel tempo sui valori precedenti. Lacune, sbrinamento, resistenza elettrica e cambi di modalità interrompono il calcolo della media. Il raffrescamento non è un COP di riscaldamento.",
    ". Azul: aquecimento; violeta: água quente. Tracejado: média do COP por intervalo; contínuo: média móvel ponderada pelo tempo. Lacunas, descongelação, resistência elétrica e mudanças de modo interrompem a suavização. O arrefecimento não é um COP de aquecimento."
  ],
  "COP wird geladen …": [
    "Loading COP …",
    "Chargement du COP…",
    "Cargando COP…",
    "Caricamento del COP …",
    "A carregar COP …"
  ],
  "Simulation · synthetische Messgrenze": [
    "Simulation · Synthetic measurement boundary",
    "Simulation · Périmètre de mesure synthétique",
    "Simulación · Perímetro de medición sintético",
    "Simulazione · confine di misura sintetico",
    "Simulação · âmbito de medição sintético"
  ],
  
  "MQTT · Extra-Leistungswerte": [
    "MQTT · Extra power readings",
    "MQTT · Mesures de puissance Extra",
    "MQTT · Mediciones de potencia Extra",
    "MQTT · valori di potenza extra",
    "MQTT · Valores de potência extra"
  ],
  "· Mindestleistung": [
    "· Minimum power",
    "· Puissance minimale",
    "· Potencia mínima",
    "· Potenza minima",
    "· Potência mínima"
  ],
  "W · Empfangsabstand ≤": [
    "W · Reception interval ≤",
    "W · Intervalle de réception ≤",
    "W · Separación de recepción ≤",
    "W · Distanza tra le ricezioni ≤",
    "W · Intervalo de receção ≤"
  ],
  "Messwerte höchstens 120 s alt. COP gesperrt bei Heizstabstatus aktiv oder Kanal A ab": [
    "Readings at most 120 s old. COP blocked when the backup heater is active or channel A reaches",
    "Mesures de 120 s maximum. COP bloqué si la résistance est active ou si le canal A atteint",
    "Mediciones de 120 s como máximo. COP bloqueado si la resistencia está activa o el canal A alcanza",
    "Valori misurati non più vecchi di 120 s. COP bloccato con resistenza elettrica attiva o canale A a partire da",
    "Medições com no máximo 120 s. COP bloqueado com resistência elétrica ativa ou canal A a partir de"
  ],
  "W (vorläufige Grenze).": [
    "W (provisional threshold).",
    "W (seuil provisoire).",
    "W (umbral provisional).",
    "W (limite provvisorio).",
    "W (limite provisório)."
  ],
  "COP und gleitender Mittelwert; Heizen blau, Warmwasser violett. Werte auch in Tabelle.": [
    "COP and moving average; heating blue, hot water purple. Values also in table.",
    "COP et moyenne glissante ; chauffage en bleu, eau chaude en violet. Valeurs aussi dans le tableau.",
    "COP y media móvil; calefacción azul, agua caliente violeta. Valores también en la tabla.",
    "COP e media mobile; riscaldamento in blu, acqua calda in viola. Valori anche in tabella.",
    "COP e média móvel; aquecimento a azul, água quente a violeta. Valores também na tabela."
  ],
  "Keine ausreichend gültigen Leistungsintervalle für COP.": [
    "No sufficiently valid power intervals for COP.",
    "Aucun intervalle de puissance suffisamment valide pour le COP.",
    "Sin intervalos de potencia suficientemente válidos para el COP.",
    "Intervalli di potenza sufficientemente validi per il COP non disponibili.",
    "Intervalos de potência suficientemente válidos insuficientes para o COP."
  ],
  "Gültige Dauer:": [
    "Valid duration:",
    "Durée valide :",
    "Duración válida:",
    "Durata valida:",
    "Duração válida:"
  ],
  "h. Energieverhältnis dieser Intervalle:": [
    "h. Energy ratio for these intervals:",
    "h. Rapport énergétique de ces intervalles :",
    "h. Relación energética de estos intervalos:",
    "h. Rapporto energetico di questi intervalli:",
    "h. Rácio de energia destes intervalos:"
  ],
  ". Kein Mittelwert der COP-Linie und keine Jahresarbeitszahl.": [
    ". Not an average of the COP line and not an annual performance factor.",
    ". Ni moyenne de la courbe COP, ni coefficient de performance annuel.",
    ". No es una media de la línea COP ni un factor de rendimiento anual.",
    ". Non è una media della curva COP né un coefficiente di prestazione annuale.",
    ". Não é a média da linha de COP nem um coeficiente de desempenho anual."
  ],
  "COP-Wertetabelle (letzte 20 Intervalle)": [
    "COP table (last 20 intervals)",
    "Tableau COP (20 derniers intervalles)",
    "Tabla COP (últimos 20 intervalos)",
    "Tabella valori COP (ultimi 20 intervalli)",
    "Tabela de valores COP (últimos 20 intervalos)"
  ],
  "Bereich": [
    "Mode",
    "Mode",
    "Modo",
    "Ambito",
    "Área"
  ],
  "Mittelwert": [
    "Average",
    "Moyenne",
    "Media",
    "Media",
    "Média"
  ],
  "Gültig / erwartet": [
    "Valid / Expected",
    "Valide / Attendu",
    "Válido / Esperado",
    "Valido / previsto",
    "Válido / esperado"
  ],
  "Tagesverbrauch ·": [
    "Daily consumption ·",
    "Consommation quotidienne ·",
    "Consumo diario ·",
    "Consumo giornaliero ·",
    "Consumo diário ·"
  ],
  "erfasste Extra-Energie": [
    "Recorded Extra energy",
    "Énergie Extra enregistrée",
    "Energía Extra registrada",
    "energia extra registrata",
    "energia extra registada"
  ],
  "Kalenderjahr": [
    "Calendar year",
    "Année civile",
    "Año natural",
    "Anno solare",
    "Ano civil"
  ],
  "Aus Leistung berechnete Energie: C = Wärmepumpe mit Innengerät und Umwälzpumpe, A = Heizstab, B bleibt unberücksichtigt. Auch Verbrauch unter 50 W wird erfasst. Messlücken über 20 s werden nicht überbrückt; keine Hochrechnung und kein Energiezählerstand.": [
    "Energy calculated from power: C = heat pump with indoor unit and circulation pump, A = backup heater, B is excluded. Consumption below 50 W is also recorded. Gaps over 20 s are not bridged; no extrapolation and not an energy meter reading.",
    "Énergie calculée à partir de la puissance : C = pompe à chaleur avec unité intérieure et circulateur, A = résistance, B exclu. La consommation sous 50 W est aussi enregistrée. Les lacunes de plus de 20 s ne sont pas comblées ; aucune extrapolation, ni relevé de compteur.",
    "Energía calculada a partir de la potencia: C = bomba de calor con unidad interior y bomba de circulación, A = resistencia, B excluido. También se registra el consumo inferior a 50 W. No se cubren lagunas de más de 20 s; sin extrapolación y no es una lectura de contador.",
    "Energia calcolata dalla potenza: C = pompa di calore con unità interna e circolatore, A = resistenza elettrica, B non viene considerato. Si registra anche il consumo sotto i 50 W. Le lacune di misura oltre 20 s non vengono colmate; nessuna estrapolazione e nessuna lettura di contatore energetico.",
    "Energia calculada a partir da potência: C = bomba de calor com unidade interior e bomba circuladora, A = resistência elétrica, B não é considerado. O consumo abaixo de 50 W também é registado. Lacunas superiores a 20 s não são preenchidas; sem extrapolação e sem leitura de contador de energia."
  ],
  "Integration elektrischer Extra-Leistung, kein geeichter Gesamtverbrauch. Keine Hochrechnung und keine Addition gleichzeitig positiver Betriebsbereiche. Pumpen und externe Verbraucher sind nicht als vollständig erfasst nachgewiesen.": [
    "Integration of Extra electrical power, not certified total consumption. No extrapolation or addition of simultaneously positive operating modes. Full coverage of pumps and external loads has not been established.",
    "Intégration de la puissance électrique Extra, pas une consommation totale certifiée. Aucune extrapolation ni addition de modes simultanément positifs. La couverture complète des pompes et consommateurs externes n’est pas établie.",
    "Integración de la potencia eléctrica Extra, no es consumo total certificado. Sin extrapolación ni suma de modos positivos simultáneos. No se ha demostrado la cobertura completa de bombas y consumos externos.",
    "Integrazione della potenza elettrica extra, non un consumo totale certificato. Nessuna estrapolazione e nessuna somma di ambiti operativi contemporaneamente positivi. Non è dimostrata la misurazione completa di pompe e utenze esterne.",
    "Integração da potência elétrica extra, não é um consumo total certificado. Sem extrapolação nem soma de modos de funcionamento simultaneamente positivos. Não está comprovado que bombas e consumidores externos sejam integralmente abrangidos."
  ],
  "Tagesenergie wird geladen …": [
    "Loading daily energy …",
    "Chargement de l’énergie quotidienne…",
    "Cargando energía diaria…",
    "Caricamento dell’energia giornaliera …",
    "A carregar energia diária …"
  ],
  "· Tage in Europe/Berlin · Vollständige und unvollständige Tage ab 20 h Abdeckung erhalten die blaue Verbrauchsfarbe.": [
    "· Days in Europe/Berlin · Complete days and incomplete days with at least 20 h coverage receive the blue consumption colour.",
    "· Jours en Europe/Berlin · Les jours complets et incomplets avec au moins 20 h de couverture reçoivent la couleur bleue de consommation.",
    "· Días en Europe/Berlin · Los días completos e incompletos con al menos 20 h de cobertura reciben el color azul de consumo.",
    "· Giorni in Europe/Berlin · I giorni completi e incompleti con almeno 20 h di copertura ricevono il colore blu del consumo.",
    "· Dias em Europe/Berlin · Os dias completos e incompletos com pelo menos 20 h de cobertura recebem a cor azul de consumo."
  ],
  "! Unvollständig · … Laufender Tag · – Keine Daten · Leeres graues Feld: zukünftig. Farbskala: 0 bis zum größten eingefärbten Tageswert dieses Jahres. Tag anklicken oder in der Tabelle wählen, um den Verlauf zu öffnen.": [
    "! Incomplete · … Current day · – No data · Empty grey cell: future. Scale: 0 to the largest coloured daily value this year. Click a day or select it in the table to open history.",
    "! Incomplet · … Journée en cours · – Aucune donnée · Case grise vide : à venir. Échelle : 0 à la valeur quotidienne colorée maximale de l’année. Cliquez sur un jour ou sélectionnez-le dans le tableau pour ouvrir l’historique.",
    "! Incompleto · … Día en curso · – Sin datos · Casilla gris vacía: futuro. Escala: 0 al mayor valor diario coloreado del año. Pulsa un día o selecciónalo en la tabla para abrir el historial.",
    "! Incompleto · … Giorno in corso · – Nessun dato · Casella grigia vuota: futuro. Scala colori: da 0 al massimo valore giornaliero colorato dell’anno. Fai clic su un giorno o selezionalo nella tabella per aprire lo storico.",
    "! Incompleto · … Dia em curso · – Sem dados · Célula cinzenta vazia: futuro. Escala de cores: de 0 ao maior valor diário colorido deste ano. Clique num dia ou selecione-o na tabela para abrir o histórico."
  ],
  "Verbrauchskalender {0}. Unvollständige Tage getrennt gekennzeichnet. Tastaturauswahl in der Tagestabelle.": [
    "Consumption calendar {0}. Incomplete days marked separately. Keyboard selection in the daily table.",
    "Calendrier de consommation {0}. Jours incomplets signalés séparément. Sélection au clavier dans le tableau quotidien.",
    "Calendario de consumo {0}. Días incompletos marcados por separado. Selección con teclado en la tabla diaria.",
    "Calendario dei consumi {0}. Giorni incompleti contrassegnati separatamente. Selezione da tastiera nella tabella giornaliera.",
    "Calendário de consumo {0}. Dias incompletos assinalados separadamente. Seleção por teclado na tabela diária."
  ],
  "Tagestabelle und Tagesauswahl": [
    "Daily table and day selection",
    "Tableau quotidien et sélection du jour",
    "Tabla diaria y selección del día",
    "Tabella e selezione dei giorni",
    "Tabela diária e seleção de dia"
  ],
  "Tag": [
    "Day",
    "Jour",
    "Día",
    "Giorno",
    "Dia"
  ],
  "Erfasst": [
    "Recorded",
    "Enregistré",
    "Registrado",
    "Registrato",
    "Registado"
  ],
  "Wärmepumpe C · Energie / Abdeckung": [
    "Heat pump C · Energy / Coverage",
    "Pompe à chaleur C · Énergie / Couverture",
    "Bomba de calor C · Energía / Cobertura",
    "Pompa di calore C · Energia / Copertura",
    "Bomba de calor C · Energia / Cobertura"
  ],
  "Heizstab A · Energie / Abdeckung": [
    "Heater A · Energy / Coverage",
    "Résistance A · Énergie / Couverture",
    "Resistencia A · Energía / Cobertura",
    "Resistenza elettrica A · Energia / Copertura",
    "Resistência elétrica A · Energia / Cobertura"
  ],
  "Abdeckung": [
    "Coverage",
    "Couverture",
    "Cobertura",
    "Copertura",
    "Cobertura"
  ],
  "Status": [
    "Status",
    "État",
    "Estado",
    "Stato",
    "Estado"
  ],
  "Heizbetrieb aus": [
    "Heating off",
    "Chauffage arrêté",
    "Calefacción apagada",
    "Riscaldamento spento",
    "Aquecimento desligado"
  ],
  "{0}\nAußen: {1} °C\nVorlauf-Soll: {2} °C": [
    "{0}\nOutdoor: {1} °C\nFlow setpoint: {2} °C",
    "{0}\nExtérieur : {1} °C\nConsigne de départ : {2} °C",
    "{0}\nExterior: {1} °C\nConsigna de impulsión: {2} °C",
    "{0}\nEsterno: {1} °C\nSetpoint di mandata: {2} °C",
    "{0}\nExterior: {1} °C\nTemperatura de ida definida: {2} °C"
  ],
  "Außentemperatur (°C)": [
    "Outdoor temperature (°C)",
    "Température extérieure (°C)",
    "Temperatura exterior (°C)",
    "Temperatura esterna (°C)",
    "Temperatura exterior (°C)"
  ],
  "Vorlauf-Solltemperatur (°C)": [
    "Flow setpoint temperature (°C)",
    "Température de consigne de départ (°C)",
    "Temperatura de consigna de impulsión (°C)",
    "Temperatura di mandata impostata (°C)",
    "Temperatura de ida definida (°C)"
  ],
  "Aus ab {0} °C": [
    "Off above {0} °C",
    "Arrêt au-dessus de {0} °C",
    "Apagado por encima de {0} °C",
    "Spento da {0} °C",
    "Desligado a partir de {0} °C"
  ],
  "Heizkurve von {0} °C außen mit {1} °C Vorlauf bis {2} °C außen mit {3} °C Vorlauf. Heizgrenze {4} °C.": [
    "Heating curve from {0} °C outdoors at {1} °C flow to {2} °C outdoors at {3} °C flow. Heating cutoff {4} °C.",
    "Courbe de {0} °C extérieurs à {1} °C de départ jusqu’à {2} °C extérieurs à {3} °C de départ. Seuil d’arrêt {4} °C.",
    "Curva desde {0} °C exteriores con {1} °C de impulsión hasta {2} °C exteriores con {3} °C de impulsión. Límite de calefacción {4} °C.",
    "Curva climatica da {0} °C esterni con {1} °C di mandata a {2} °C esterni con {3} °C di mandata. Limite di riscaldamento {4} °C.",
    "Curva de aquecimento de {0} °C no exterior com {1} °C de ida até {2} °C no exterior com {3} °C de ida. Limite de aquecimento {4} °C."
  ],
  "Zustände verdichtet: Wechsel innerhalb eines Rasters bleiben unbekannt. Für mehr Details Zeitraum verkleinern.": [
    "States aggregated: transitions within a sampling interval remain unknown. Narrow the period for more detail.",
    "États agrégés : transitions dans un intervalle inconnues. Réduisez la période pour plus de détails.",
    "Estados agregados: los cambios dentro de un intervalo siguen siendo desconocidos. Reduce el periodo para más detalle.",
    "Stati aggregati: i cambi all’interno di un intervallo restano sconosciuti. Riduci il periodo per maggiori dettagli.",
    "Estados agregados: as transições dentro de um intervalo permanecem desconhecidas. Reduza o período para mais detalhes."
  ],
  "· Raster": [
    "· Sampling interval",
    "· Intervalle",
    "· Intervalo",
    "· Intervallo",
    "· Intervalo"
  ],
  "s · Nur gültige Zustandsintervalle": [
    "s · Valid state intervals only",
    "s · Intervalles d’état valides uniquement",
    "s · Solo intervalos de estado válidos",
    "s · Solo intervalli di stato validi",
    "s · Apenas intervalos de estado válidos"
  ],
  "{0} – Zeit von links nach rechts. Datenlücken bleiben leer.": [
    "{0} – Time from left to right. Data gaps remain empty.",
    "{0} – Temps de gauche à droite. Les lacunes restent vides.",
    "{0} – Tiempo de izquierda a derecha. Las lagunas quedan vacías.",
    "{0} – Tempo da sinistra a destra. Le lacune nei dati rimangono vuote.",
    "{0} – Tempo da esquerda para a direita. As lacunas permanecem vazias."
  ],
  "Keine gültigen Zustandsintervalle": [
    "No valid state intervals",
    "Aucun intervalle d’état valide",
    "Sin intervalos de estado válidos",
    "Nessun intervallo di stato valido",
    "Sem intervalos de estado válidos"
  ],
  "Zustandsintervalle ·": [
    "State intervals ·",
    "Intervalles d’état ·",
    "Intervalos de estado ·",
    "Intervalli di stato ·",
    "Intervalos de estado ·"
  ],
  "Von · Berlin": [
    "From · Berlin",
    "Du · Berlin",
    "Desde · Berlín",
    "Da · Berlino",
    "De · Berlim"
  ],
  "Bis · Berlin": [
    "To · Berlin",
    "Au · Berlin",
    "Hasta · Berlín",
    "A · Berlino",
    "Até · Berlim"
  ],
  "Zustand": [
    "State",
    "État",
    "Estado",
    "Stato",
    "Estado"
  ],
  "Dauer": [
    "Duration",
    "Durée",
    "Duración",
    "Durata",
    "Duração"
  ],
  ". Lücken werden nicht verbunden. Werte auch in der Tabelle.": [
    ". Gaps are not connected. Values also in the table.",
    ". Les lacunes ne sont pas reliées. Valeurs aussi dans le tableau.",
    ". Las lagunas no se conectan. Valores también en la tabla.",
    ". Le lacune non vengono collegate. Valori anche in tabella.",
    ". As lacunas não são ligadas. Valores também na tabela."
  ],
  "Noch keine gültigen Verlaufswerte": [
    "No valid history readings yet",
    "Aucune mesure historique valide pour le moment",
    "Todavía sin mediciones históricas válidas",
    "Nessun valore storico ancora valido",
    "Ainda sem valores históricos válidos"
  ],
  "Die Aufzeichnung beginnt mit diesem Release. Datenlücken werden nicht aufgefüllt.": [
    "Recording begins with this release. Data gaps are not filled.",
    "L’enregistrement commence avec cette version. Les lacunes ne sont pas comblées.",
    "El registro comienza con esta versión. Las lagunas no se rellenan.",
    "La registrazione inizia con questa versione. Le lacune nei dati non vengono riempite.",
    "O registo começa com esta versão. As lacunas não são preenchidas."
  ],
  "Zeiten: Europe/Berlin · Raster": [
    "Times: Europe/Berlin · Sampling interval",
    "Heures : Europe/Berlin · Intervalle",
    "Horas: Europe/Berlin · Intervalo",
    "Orari: Europe/Berlin · Intervallo",
    "Horas: Europe/Berlin · Intervalo"
  ],
  "s · Mittelwerte nur aus vollständig gültigen Intervallen; Zustände nur bei unverändertem Wert. Lücken bleiben leer.": [
    "s · Averages only from fully valid intervals; states only when unchanged. Gaps remain empty.",
    "s · Moyennes issues uniquement d’intervalles entièrement valides ; états uniquement si constants. Les lacunes restent vides.",
    "s · Medias solo de intervalos completamente válidos; estados solo si no cambian. Las lagunas quedan vacías.",
    "s · Medie solo da intervalli completamente validi; stati solo se il valore rimane invariato. Le lacune restano vuote.",
    "s · Médias apenas de intervalos totalmente válidos; estados apenas com valor inalterado. As lacunas permanecem vazias."
  ],
  "Wertetabelle (letzte 20 Intervalle je Reihe)": [
    "Value table (last 20 intervals per series)",
    "Tableau de valeurs (20 derniers intervalles par série)",
    "Tabla de valores (últimos 20 intervalos por serie)",
    "Tabella valori (ultimi 20 intervalli per serie)",
    "Tabela de valores (últimos 20 intervalos por série)"
  ],
  "Wert": [
    "Value",
    "Valeur",
    "Valor",
    "Valore",
    "Valor"
  ],
  "Qualität": [
    "Quality",
    "Qualité",
    "Calidad",
    "Qualità",
    "Qualidade"
  ],
  "{0}\n{1} – {2}\nDauer: {3} s\nAktuell · {4} · Raster {5} s": [
    "{0}\n{1} – {2}\nDuration: {3} s\nCurrent · {4} · Sampling {5} s",
    "{0}\n{1} – {2}\nDurée : {3} s\nÀ jour · {4} · Intervalle {5} s",
    "{0}\n{1} – {2}\nDuración: {3} s\nActual · {4} · Intervalo {5} s",
    "{0}\n{1} – {2}\nDurata: {3} s\nAggiornato · {4} · Intervallo {5} s",
    "{0}\n{1} – {2}\nDuração: {3} s\nAtual · {4} · Intervalo {5} s"
  ],
  "Diese Optionskombination kann nicht dargestellt werden. Optionen korrigieren oder Einstellungen zurücksetzen.": [
    "This option combination cannot be displayed. Correct the options or reset settings.",
    "Cette combinaison d’options ne peut pas être affichée. Corrigez les options ou réinitialisez les paramètres.",
    "No se puede mostrar esta combinación de opciones. Corrige las opciones o restablece los ajustes.",
    "Questa combinazione di opzioni non può essere visualizzata. Correggi le opzioni o ripristina le impostazioni.",
    "Não é possível apresentar esta combinação de opções. Corrija as opções ou reponha as definições."
  ],
  "Messwertdiagramm; Werte auch in der Tabelle": [
    "Reading chart; values also in the table",
    "Graphique des mesures ; valeurs aussi dans le tableau",
    "Gráfico de mediciones; valores también en la tabla",
    "Grafico del valore misurato; valori anche in tabella",
    "Gráfico de medições; valores também na tabela"
  ],
  "Diagrammwerkzeuge": [
    "Chart tools",
    "Outils du graphique",
    "Herramientas del gráfico",
    "Strumenti del grafico",
    "Ferramentas do gráfico"
  ],
  "Gesamter Zeitraum": [
    "Full period",
    "Période complète",
    "Periodo completo",
    "Intero periodo",
    "Período completo"
  ],
  "Bildexport fehlgeschlagen. Externe Bildressourcen können den Export verhindern.": [
    "Image export failed. External image resources may prevent export.",
    "Échec d’export d’image. Des ressources externes peuvent empêcher l’export.",
    "Error al exportar la imagen. Los recursos externos pueden impedir la exportación.",
    "Esportazione dell’immagine non riuscita. Risorse grafiche esterne possono impedirla.",
    "A exportação da imagem falhou. Recursos de imagem externos podem impedir a exportação."
  ],
  "Diagrammbild speichern": [
    "Save chart image",
    "Enregistrer l’image du graphique",
    "Guardar imagen del gráfico",
    "Salva l’immagine del grafico",
    "Guardar imagem do gráfico"
  ],
  "Verlauf konnte nicht geladen werden. Bitte erneut versuchen.": [
    "Unable to load history. Please try again.",
    "Impossible de charger l’historique. Réessayez.",
    "No se pudo cargar el historial. Inténtalo de nuevo.",
    "Impossibile caricare lo storico. Riprova.",
    "Não foi possível carregar o histórico. Tente novamente."
  ],
  "Einstellungen für diesen Messwert gespeichert.": [
    "Settings saved for this reading.",
    "Paramètres enregistrés pour cette mesure.",
    "Ajustes guardados para esta medición.",
    "Impostazioni salvate per questo valore misurato.",
    "Definições guardadas para esta medição."
  ],
  "Einstellungen gelten nur für diese Sitzung; Browserspeicher nicht verfügbar.": [
    "Settings apply to this session only; browser storage unavailable.",
    "Paramètres valables uniquement pour cette session ; stockage indisponible.",
    "Los ajustes se aplican solo a esta sesión; almacenamiento no disponible.",
    "Le impostazioni valgono solo per questa sessione; memoria del browser non disponibile.",
    "As definições aplicam-se apenas a esta sessão; armazenamento do navegador indisponível."
  ],
  "CSV-Export fehlgeschlagen.": [
    "CSV export failed.",
    "Échec de l’export CSV.",
    "Error al exportar CSV.",
    "Esportazione CSV non riuscita.",
    "A exportação CSV falhou."
  ],
  "Übersicht · Messwertdetails": [
    "Overview · Reading details",
    "Vue d’ensemble · Détails de la mesure",
    "Resumen · Detalles de la medición",
    "Panoramica · Dettagli del valore misurato",
    "Visão geral · Detalhes da medição"
  ],
  "– Diagramm": [
    "– Chart",
    "– Graphique",
    "– Gráfico",
    "– Grafico",
    "– Gráfico"
  ],
  "Diagramm schließen": [
    "Close chart",
    "Fermer le graphique",
    "Cerrar gráfico",
    "Chiudi il grafico",
    "Fechar gráfico"
  ],
  "Schließen ✕": [
    "Close ✕",
    "Fermer ✕",
    "Cerrar ✕",
    "Chiudi ✕",
    "Fechar ✕"
  ],
  "Fehlercodes sind Textwerte und werden als gespeicherte Ereignisse angezeigt, nicht als erfundene Zahlenkurve.": [
    "Fault codes are text values and are shown as stored events, not as invented numerical curves.",
    "Les codes de défaut sont textuels et affichés comme événements enregistrés, pas comme courbes numériques inventées.",
    "Los códigos de fallo son textos y se muestran como eventos guardados, no como curvas numéricas inventadas.",
    "I codici di errore sono valori testuali e vengono mostrati come eventi salvati, non come una curva numerica inventata.",
    "Os códigos de erro são valores de texto e são apresentados como eventos guardados, não como uma curva numérica inventada."
  ],
  "Zeitraum": [
    "Period",
    "Période",
    "Periodo",
    "Periodo",
    "Período"
  ],
  "Letzte Stunde": [
    "Last hour",
    "Dernière heure",
    "Última hora",
    "Ultima ora",
    "Última hora"
  ],
  "Letzte 6 Stunden": [
    "Last 6 hours",
    "6 dernières heures",
    "Últimas 6 horas",
    "Ultime 6 ore",
    "Últimas 6 horas"
  ],
  "Letzte 24 Stunden": [
    "Last 24 hours",
    "24 dernières heures",
    "Últimas 24 horas",
    "Ultime 24 ore",
    "Últimas 24 horas"
  ],
  "Letzte 7 Tage": [
    "Last 7 days",
    "7 derniers jours",
    "Últimos 7 días",
    "Ultimi 7 giorni",
    "Últimos 7 dias"
  ],
  "Letzte 30 Tage": [
    "Last 30 days",
    "30 derniers jours",
    "Últimos 30 días",
    "Ultimi 30 giorni",
    "Últimos 30 dias"
  ],
  "Gültigen Zeitraum bis jetzt wählen (höchstens 700 Tage).": [
    "Select a valid period ending no later than now (maximum 700 days).",
    "Choisissez une période valide se terminant au plus tard maintenant (700 jours maximum).",
    "Selecciona un periodo válido hasta el momento actual (máximo 700 días).",
    "Seleziona un periodo valido fino a ora (massimo 700 giorni).",
    "Selecione um período válido até ao momento atual (no máximo 700 dias)."
  ],
  "Zeitraum anwenden": [
    "Apply period",
    "Appliquer la période",
    "Aplicar periodo",
    "Applica il periodo",
    "Aplicar período"
  ],
  "Neu laden": [
    "Reload",
    "Recharger",
    "Recargar",
    "Ricarica",
    "Recarregar"
  ],
  "Messwerte als CSV": [
    "Readings as CSV",
    "Mesures en CSV",
    "Mediciones en CSV",
    "Valori misurati in CSV",
    "Medições em CSV"
  ],
  "Messwertverlauf wird geladen …": [
    "Loading reading history …",
    "Chargement de l’historique de mesure…",
    "Cargando historial de la medición…",
    "Caricamento dello storico dei valori misurati …",
    "A carregar histórico de medições …"
  ],
  "SIMULATION · Simulierte Messwerte": [
    "SIMULATION · Simulated readings",
    "SIMULATION · Mesures simulées",
    "SIMULACIÓN · Mediciones simuladas",
    "SIMULAZIONE · Valori misurati simulati",
    "SIMULAÇÃO · Medições simuladas"
  ],
  "MQTT · Aufgezeichnete Messwerte": [
    "MQTT · Recorded readings",
    "MQTT · Mesures enregistrées",
    "MQTT · Mediciones registradas",
    "MQTT · Valori misurati registrati",
    "MQTT · Medições registadas"
  ],
  "s · Einheit": [
    "s · Unit",
    "s · Unité",
    "s · Unidad",
    "s · Unità",
    "s · Unidade"
  ],
  "ohne Einheit": [
    "No unit",
    "Sans unité",
    "Sin unidad",
    "senza unità",
    "sem unidade"
  ],
  "Keine gültigen Messwerte im ausgewählten Zeitraum. Datenlücken bleiben leer.": [
    "No valid readings in the selected period. Data gaps remain empty.",
    "Aucune mesure valide dans la période sélectionnée. Les lacunes restent vides.",
    "Sin mediciones válidas en el periodo seleccionado. Las lagunas quedan vacías.",
    "Nessun valore misurato valido nel periodo selezionato. Le lacune nei dati restano vuote.",
    "Sem medições válidas no período selecionado. As lacunas permanecem vazias."
  ],
  "Zoom mit dem Schieberegler oder Strg + Mausrad. Die Tabelle zeigt bis zu 100 verdichtete Intervalle; CSV enthält die Rohwerte des gewählten Zeitraums (höchstens 30 Tage und 100.000 Werte). Erweiterte Optionen verändern nur die Darstellung.": [
    "Zoom with the slider or Ctrl + mouse wheel. The table shows up to 100 aggregated intervals; CSV contains raw values for the chosen period (up to 30 days and 100,000 values). Advanced options change presentation only.",
    "Zoomez avec le curseur ou Ctrl + molette. Le tableau affiche jusqu’à 100 intervalles agrégés ; le CSV contient les valeurs brutes de la période (30 jours et 100 000 valeurs maximum). Les options avancées changent uniquement la présentation.",
    "Amplía con el deslizador o Ctrl + rueda. La tabla muestra hasta 100 intervalos agregados; el CSV contiene valores originales del periodo (hasta 30 días y 100.000 valores). Las opciones avanzadas solo cambian la presentación.",
    "Zoom con il cursore o Ctrl + rotellina. La tabella mostra fino a 100 intervalli aggregati; il CSV contiene i valori grezzi del periodo selezionato (massimo 30 giorni e 100.000 valori). Le opzioni avanzate modificano solo la visualizzazione.",
    "Zoom com o seletor deslizante ou Ctrl + roda do rato. A tabela mostra até 100 intervalos agregados; o CSV contém os valores brutos do período selecionado (no máximo 30 dias e 100.000 valores). As opções avançadas alteram apenas a apresentação."
  ],
  "Diagramm anpassen": [
    "Customise chart",
    "Personnaliser le graphique",
    "Personalizar gráfico",
    "Personalizza il grafico",
    "Personalizar gráfico"
  ],
  "Linie": [
    "Line",
    "Ligne",
    "Línea",
    "Linea",
    "Linha"
  ],
  "Balken": [
    "Bars",
    "Barres",
    "Barras",
    "Barre",
    "Barras"
  ],
  "Punkte": [
    "Points",
    "Points",
    "Puntos",
    "Punti",
    "Pontos"
  ],
  "Farbe": [
    "Colour",
    "Couleur",
    "Color",
    "Colore",
    "Cor"
  ],
  "Fläche": [
    "Area",
    "Surface",
    "Área",
    "Area",
    "Área"
  ],
  "Stufenlinie": [
    "Step line",
    "Ligne en escalier",
    "Línea escalonada",
    "Linea a gradini",
    "Linha em degraus"
  ],
  "Messpunkte": [
    "Data points",
    "Points de mesure",
    "Puntos de medición",
    "Punti di misura",
    "Pontos de medição"
  ],
  "Höhe": [
    "Height",
    "Hauteur",
    "Altura",
    "Altezza",
    "Altura"
  ],
  "Renderer": [
    "Renderer",
    "Moteur de rendu",
    "Motor de renderizado",
    "Renderer",
    "Motor de renderização"
  ],
  "Canvas": [
    "Canvas",
    "Canvas",
    "Canvas",
    "Canvas",
    "Canvas"
  ],
  "Erweiterte ECharts-Optionen (JSON)": [
    "Advanced ECharts options (JSON)",
    "Options ECharts avancées (JSON)",
    "Opciones avanzadas de ECharts (JSON)",
    "Opzioni ECharts avanzate (JSON)",
    "Opções avançadas do ECharts (JSON)"
  ],
  "Alle ECharts-Kernmodule sind geladen. JSON-Optionen werden über die Grundeinstellungen gelegt; Komponentenlisten werden positionsweise ergänzt. Beispiel:": [
    "All ECharts core modules are loaded. JSON options override the defaults; component lists are merged by position. Example:",
    "Tous les modules principaux ECharts sont chargés. Les options JSON remplacent les valeurs par défaut ; les listes de composants sont fusionnées par position. Exemple :",
    "Todos los módulos principales de ECharts están cargados. Las opciones JSON sobrescriben los valores predeterminados; las listas de componentes se combinan por posición. Ejemplo:",
    "Tutti i moduli principali di ECharts sono caricati. Le opzioni JSON vengono sovrapposte alle impostazioni di base; gli elenchi di componenti vengono integrati per posizione. Esempio:",
    "Todos os módulos principais do ECharts estão carregados. As opções JSON sobrepõem-se às definições básicas; as listas de componentes são complementadas por posição. Exemplo:"
  ],
  ". Daten können mit eigenen Optionen überschrieben werden. JavaScript-Callbacks, externe Erweiterungen (z. B. ECharts GL) und zusätzliche Kartendaten sind hier nicht enthalten.": [
    ". Data may be overridden by custom options. JavaScript callbacks, external extensions (e.g. ECharts GL) and additional map data are not included here.",
    ". Les options personnalisées peuvent remplacer les données. Les fonctions JavaScript, extensions externes (p. ex. ECharts GL) et données cartographiques supplémentaires ne sont pas incluses.",
    ". Las opciones personalizadas pueden sobrescribir los datos. No se incluyen funciones JavaScript, extensiones externas (p. ej. ECharts GL) ni datos cartográficos adicionales.",
    ". Le opzioni personalizzate possono sovrascrivere i dati. Callback JavaScript, estensioni esterne (ad es. ECharts GL) e dati cartografici aggiuntivi non sono inclusi.",
    ". Os dados podem ser substituídos por opções personalizadas. Funções de retorno JavaScript, extensões externas (por exemplo, ECharts GL) e dados de mapas adicionais não estão incluídos."
  ],
  "ECharts-Optionsreferenz": [
    "ECharts option reference",
    "Référence des options ECharts",
    "Referencia de opciones ECharts",
    "Guida alle opzioni ECharts",
    "Referência de opções do ECharts"
  ],
  "Ungültige Optionen: Ein gültiges JSON-Objekt mit höchstens 100.000 Zeichen wird erwartet.": [
    "Invalid options: expected a valid JSON object with at most 100,000 characters.",
    "Options invalides : un objet JSON valide de 100 000 caractères maximum est attendu.",
    "Opciones no válidas: se espera un objeto JSON válido de hasta 100.000 caracteres.",
    "Opzioni non valide: è previsto un oggetto JSON valido con un massimo di 100.000 caratteri.",
    "Opções inválidas: é esperado um objeto JSON válido com no máximo 100.000 caracteres."
  ],
  "Optionen anwenden": [
    "Apply options",
    "Appliquer les options",
    "Aplicar opciones",
    "Applica le opzioni",
    "Aplicar opções"
  ],
  "Einstellungen zurücksetzen": [
    "Reset settings",
    "Réinitialiser les paramètres",
    "Restablecer ajustes",
    "Ripristina le impostazioni",
    "Repor definições"
  ],
  "Benutzerdefinierte ECharts-Optionen aktiv. Maßgeblich bleiben die Originalwerte in Tabelle und CSV.": [
    "Custom ECharts options active. Original values in the table and CSV remain authoritative.",
    "Options ECharts personnalisées actives. Les valeurs originales du tableau et du CSV restent la référence.",
    "Opciones personalizadas de ECharts activas. Los valores originales de la tabla y el CSV siguen siendo la referencia.",
    "Opzioni ECharts personalizzate attive. Fanno fede i valori originali nella tabella e nel CSV.",
    "Opções personalizadas do ECharts ativas. Os valores originais na tabela e no CSV continuam a ser a referência."
  ],
  "Originalwerte und Qualität (letzte 100 Einträge)": [
    "Original values and quality (last 100 entries)",
    "Valeurs originales et qualité (100 dernières entrées)",
    "Valores originales y calidad (últimas 100 entradas)",
    "Valori originali e qualità (ultime 100 voci)",
    "Valores originais e qualidade (últimas 100 entradas)"
  ],
  "Gültig": [
    "Valid",
    "Valide",
    "Válido",
    "Valido",
    "Válido"
  ],
  "Die Optionen dürfen höchstens 100.000 Zeichen enthalten.": [
    "Options must not exceed 100,000 characters.",
    "Les options ne doivent pas dépasser 100 000 caractères.",
    "Las opciones no deben superar los 100.000 caracteres.",
    "Le opzioni possono contenere al massimo 100.000 caratteri.",
    "As opções podem conter no máximo 100.000 caracteres."
  ],
  "Unzulässiger Optionsschlüssel.": [
    "Disallowed option key.",
    "Clé d’option interdite.",
    "Clave de opción no permitida.",
    "Chiave di opzione non consentita.",
    "Chave de opção não permitida."
  ],
  "Ein JSON-Objekt wird erwartet.": [
    "A JSON object is required.",
    "Un objet JSON est requis.",
    "Se requiere un objeto JSON.",
    "È previsto un oggetto JSON.",
    "É esperado um objeto JSON."
  ],
  "{0}: historischer Verlauf. Fehlende oder ungültige Messwerte bleiben leer. Originalwerte und Qualität stehen in der Tabelle unter dem Diagramm.": [
    "{0}: history. Missing or invalid readings remain empty. Original values and quality are in the table below the chart.",
    "{0} : historique. Les mesures manquantes ou invalides restent vides. Les valeurs originales et la qualité figurent dans le tableau sous le graphique.",
    "{0}: historial. Las mediciones ausentes o no válidas quedan vacías. Los valores originales y la calidad están en la tabla bajo el gráfico.",
    "{0}: andamento storico. I valori mancanti o non validi rimangono vuoti. I valori originali e la qualità sono nella tabella sotto il grafico.",
    "{0}: histórico. Medições em falta ou inválidas permanecem vazias. Os valores originais e a qualidade estão na tabela abaixo do gráfico."
  ],
  "Bereich zoomen": [
    "Zoom area",
    "Zoomer sur une zone",
    "Ampliar área",
    "Zoom sull’area",
    "Ampliar área"
  ],
  "Zoom zurück": [
    "Undo zoom",
    "Annuler le zoom",
    "Deshacer zoom",
    "Zoom precedente",
    "Zoom anterior"
  ],
  "Ansicht zurücksetzen": [
    "Reset view",
    "Réinitialiser la vue",
    "Restablecer vista",
    "Ripristina la vista",
    "Repor vista"
  ],
  "Bild speichern": [
    "Save image",
    "Enregistrer l’image",
    "Guardar imagen",
    "Salva immagine",
    "Guardar imagem"
  ],
  "Verlauf nicht verfügbar.": [
    "History unavailable.",
    "Historique indisponible.",
    "Historial no disponible.",
    "Storico non disponibile.",
    "Histórico indisponível."
  ],
  "Feine Zustandsintervalle nicht verfügbar; Anzeige aus verdichteter Historie.": [
    "Detailed state intervals unavailable; displaying aggregated history.",
    "Intervalles détaillés indisponibles ; affichage de l’historique agrégé.",
    "Intervalos detallados no disponibles; se muestra el historial agregado.",
    "Intervalli di stato dettagliati non disponibili; visualizzazione dallo storico aggregato.",
    "Intervalos de estado detalhados indisponíveis; apresentação a partir do histórico agregado."
  ],
  "Paaranalyse nicht verfügbar; Spreizungsband bleibt leer.": [
    "Pair analysis unavailable; temperature difference band remains empty.",
    "Analyse des paires indisponible ; la bande d’écart reste vide.",
    "Análisis de pares no disponible; la banda de diferencia queda vacía.",
    "Analisi delle coppie non disponibile; la banda della differenza di temperatura rimane vuota.",
    "Análise de pares indisponível; a banda da diferença de temperatura permanece vazia."
  ],
  " · vor ": [
    " · ago ",
    " · il y a ",
    " · hace ",
    " · fa ",
    " · há "
  ],
  " bis ": [
    " to ",
    " à ",
    " a ",
    " a ",
    " até "
  ],
  "{0} verringern": [
    "Decrease {0}",
    "Diminuer {0}",
    "Reducir {0}",
    "Diminuisci {0}",
    "Diminuir {0}"
  ],
  "CSV exportieren": [
    "Export CSV",
    "Exporter en CSV",
    "Exportar CSV",
    "Esporta CSV",
    "Exportar CSV"
  ],
  "als CSV": [
    "as CSV",
    "en CSV",
    "en CSV",
    "in CSV",
    "em CSV"
  ],
  "· vor": [
    "· ago",
    "· il y a",
    "· hace",
    "· fa",
    "· há"
  ],
  " (simuliert)": [
    " (simulated)",
    " (simulé)",
    " (simulado)",
    " (simulato)",
    " (simulado)"
  ],
  "bis": [
    "to",
    "à",
    "a",
    "a",
    "até"
  ],
  " von ": [
    " of ",
    " sur ",
    " de ",
    " di ",
    " de "
  ],
  " verschieben": [
    " move",
    " déplacer",
    " mover",
    " sposta",
    " mover"
  ],
  "Sprache": [
    "Language",
    "Langue",
    "Idioma",
    "Lingua",
    "Idioma"
  ],
  "Sprache gilt nur für diese Sitzung: Browserspeicher nicht verfügbar.": [
    "Language applies to this session only: browser storage unavailable.",
    "La langue s’applique uniquement à cette session : stockage du navigateur indisponible.",
    "El idioma se aplica solo a esta sesión: almacenamiento del navegador no disponible.",
    "La lingua vale solo per questa sessione: memoria del browser non disponibile.",
    "O idioma aplica-se apenas a esta sessão: armazenamento do navegador indisponível."
  ],
  "Originalmeldung (Deutsch)": [
    "Original message (German)",
    "Message original (allemand)",
    "Mensaje original (alemán)",
    "Messaggio originale (tedesco)",
    "Mensagem original (alemão)"
  ],
  "Außen niedrig": [
    "Outdoor low",
    "Extérieur bas",
    "Exterior bajo",
    "Esterno basso",
    "Exterior baixo"
  ],
  "Außen hoch": [
    "Outdoor high",
    "Extérieur haut",
    "Exterior alto",
    "Esterno alto",
    "Exterior alto"
  ],
  "Vorlauf hoch": [
    "Flow high",
    "Départ haut",
    "Impulsión alta",
    "Mandata alta",
    "Ida alta"
  ],
  "Vorlauf niedrig": [
    "Flow low",
    "Départ bas",
    "Impulsión baja",
    "Mandata bassa",
    "Ida baixa"
  ],
  "Heizung aus ab": [
    "Heating off above",
    "Arrêt du chauffage au-dessus de",
    "Calefacción apagada por encima de",
    "Riscaldamento spento da",
    "Aquecimento desligado a partir de"
  ],
  "unbekannt": [
    "unknown",
    "inconnu",
    "desconocido",
    "sconosciuto",
    "desconhecido"
  ],
  "unknown": [
    "Unknown",
    "Inconnu",
    "Desconocido",
    "sconosciuto",
    "desconhecido"
  ],
  "valid": [
    "Current",
    "À jour",
    "Actual",
    "valido",
    "válido"
  ],
  "stale": [
    "Stale",
    "Périmé",
    "Desactualizado",
    "non aggiornato",
    "desatualizado"
  ],
  "invalid": [
    "Invalid",
    "Invalide",
    "No válido",
    "non valido",
    "inválido"
  ],
  "{0} auf Position {1} von {2}": [
    "{0} at position {1} of {2}",
    "{0} à la position {1} sur {2}",
    "{0} en la posición {1} de {2}",
    "{0} alla posizione {1} di {2}",
    "{0} na posição {1} de {2}"
  ],
  "{0} nach vorne": [
    "Move {0} earlier",
    "Déplacer {0} vers le début",
    "Mover {0} hacia el principio",
    "Sposta {0} avanti",
    "Mover {0} para a frente"
  ],
  "{0} nach hinten": [
    "Move {0} later",
    "Déplacer {0} vers la fin",
    "Mover {0} hacia el final",
    "Sposta {0} indietro",
    "Mover {0} para trás"
  ],
  "{0} verschieben": [
    "Move {0}",
    "Déplacer {0}",
    "Mover {0}",
    "Sposta {0}",
    "Mover {0}"
  ],
  "Zulässig sind ganze Zahlen von {0} bis {1} {2}.": [
    "Allowed whole numbers from {0} to {1} {2}.",
    "Nombres entiers autorisés de {0} à {1} {2}.",
    "Se permiten números enteros de {0} a {1} {2}.",
    "Sono ammessi numeri interi da {0} a {1} {2}.",
    "São permitidos números inteiros de {0} a {1} {2}."
  ],
  "Nicht übernommen. {0} Der bisherige Wert bleibt erhalten.": [
    "Not applied. {0} The previous value is retained.",
    "Non appliqué. {0} La valeur précédente est conservée.",
    "No aplicado. {0} Se conserva el valor anterior.",
    "Non applicato. {0} Il valore precedente viene mantenuto.",
    "Não aplicado. {0} O valor anterior é mantido."
  ],
  "Noch keine Simulatorbefehle.": [
    "No simulator commands yet.",
    "Aucune commande du simulateur pour le moment.",
    "Todavía no hay órdenes del simulador.",
    "Nessun comando del simulatore per il momento.",
    "Ainda não há comandos do simulador."
  ],
  "Noch keine Live-Befehle.": [
    "No live commands yet.",
    "Aucune commande réelle pour le moment.",
    "Todavía no hay órdenes reales.",
    "Nessun comando reale per il momento.",
    "Ainda não há comandos reais."
  ]
};
