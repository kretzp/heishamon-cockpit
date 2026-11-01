# Supported devices and control requirements

The aquarea-l-wh-wdg profile was derived from documentation for the Panasonic WH-SDC0509L3E5 indoor unit and WH-WDG05LE5 outdoor unit. The profile does not detect the model, wiring, configuration or firmware installed at a site. Verify those independently before enabling control.

The [Panasonic operating instructions](https://tda.panasonic-europe-service.com/docs/2z69138055z3z42947z656ez706466z27za0e6e6ecec90670b69c9d765c1afb44ea3a0a7d1/tsn3/data/ALL/WHSDC0509L3E5/OI/998713/WEB-ACXF55-36270-EN.pdf) describe heating-curve settings for this family. Operating limits also depend on outside temperature and installation conditions. A profile selection cannot establish that every allowed value is safe for a particular installation.

The [HeishaMon v4.2.3 MQTT topic documentation](https://github.com/heishamon/HeishaMon/blob/v4.2.3/MQTT-Topics.md) lists sterilization temperature and duration settings as experimental. They are absent from the v4.2.0 topic documentation. The firmware currently installed at a site must be checked separately. The application does not detect firmware compatibility or block these settings on older firmware.

The same HeishaMon documentation describes the zone 1 heat request temperature as -5 to 5 or 20 to max, depending on its context. The application also permits room targets from 16 to 19 °C in the relevant room-sensor mode. The sources reviewed do not resolve whether these descriptions refer to the same mode and value. Do not use values below 20 °C until the installed configuration and command semantics have been independently verified. The application does not enforce that restriction.

Check the installed firmware, sensor mode, operating limits, all other writers and the consequences of an individual command before any physical test. A separate operator decision is required for each real-world test. Broker acknowledgements and matching observations are not proof that a specific command was executed.
