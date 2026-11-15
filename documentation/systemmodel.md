# System model

**System model** is the first tab and the default view. The existing Overview remains available immediately after it.

The diagram uses the same telemetry snapshot and SignalR connection as the other views. It does not open an additional MQTT connection or send device setpoints. Outdoor and indoor housings are selected automatically from the detected Aquarea model. Known IDs and signatures are matched exactly; unknown models receive a neutral drawing without an assumed pump location.

## Configuration per installation

Administrators select **Configure model**. Options include one or two heating circuits, underfloor heating or radiators for each circuit, a hot-water tank, an inline buffer tank, pipe temperatures and animation settings. Changes appear as a preview before saving. **Cancel** restores the saved view.

**Save** stores the configuration centrally under `PlantModel` in the existing `<History:Path>.settings.json` file. It applies to all users and browsers of that installation and survives restarts. Other open System model views reload the configuration at least every 30 seconds. A save conflict prompts the user to reload; changes made by someone else are not overwritten automatically.

Only signed-in administrators can save changes. Readers and operators see the shared configuration without editing controls. The API enforces the same role restriction, existing CSRF protection and revision checks. Anonymous simulator installations without authentication provide a read-only view.

## Measurements and animation

Flow temperature, return temperature, temperature difference and water pressure are displayed with exactly two decimal places throughout the System model view, including the diagram, component inspector and measurement explorer. Number formatting follows the selected interface language.

Pump animation follows valid water-flow readings, fan animation follows fan speed, and refrigerant animation follows compressor frequency. Current activity is derived from compressor operation, valve position, defrost state and the selected operating mode. Selecting a mode alone does not indicate active heating. Pump circulation and fan run-on may remain visible independently of the compressor.

Invalid, unknown, stale, historical or retained readings, and readings that are no longer current after a connection loss, are not displayed as current measurements and do not drive animation. COP comes from the existing validated backend calculation. Electrical and thermal power are shown for the operating mode that is actually active. Missing measurements are not simulated.

The measurement explorer lists received snapshot fields, including optional and external sensors, data quality and time since receipt. The component inspector groups available readings by component. Missing zone-2 or refrigerant-circuit sensors are not invented.

Component selectors sit directly below the animated diagram. On desktop screens, their readings appear to the right of the diagram; on narrow screens, they appear below it. Fans and pump rotors rotate around fixed axes in their own local coordinates. Positioning and rotation are separate so that rotors remain inside their housings during animation and live updates.

The desktop diagram scales proportionally to a height of 370–480 pixels, while the system-status panel receives at least 320 pixels of width. Larger labels and measurement text improve readability. The component selectors remain directly underneath. Scrolling may be required depending on the window size.

## Diagram limitations

Outdoor housings and indoor modules share a common scale. Pipes and internal component positions remain schematic. H/J/K systems use refrigerant lines between the outdoor and indoor units; L/M systems use hydraulic connections. The Aquarea primary-pump marker sits inside the indoor module, or in the outdoor unit for monobloc and standalone M-series models.

Where two fans are drawn, both currently use the available Fan-1 speed reading. Heating circuit 2 and an inline buffer tank are optional diagram components; enabling them does not imply that additional sensors or a particular mixing-valve configuration are available. The tank shown in the diagram may also represent an integrated All-in-One tank. The diagram does not replace an installation drawing or hydraulic design.

The verified housing families and manufacturer sources are documented in the [design concept](../prototypes/aquarea-hydraulik/KONZEPT.md). The automated frontend test checks known model mappings against the backend catalogue.

## Automated verification

The catalogue test checks all 91 legacy IDs, the additional confirmed L-series signature and the common equipment scale. The browser matrix checks twelve representative devices from all ten housing families, including older and current All-in-One modules and the tall M-series tank. It runs on desktop and mobile and checks housing selection, fan count, pump location, fixed rotation axes, optional heating circuits and the absence of horizontal page overflow.

The operating-state matrix covers heating, hot water, cooling, defrosting, circulation, standby and connection loss. Additional tests cover stale and historical readings, unknown models, administrator permissions, CSRF, persistence across restarts and revision conflicts. These checks use simulated measurements; they do not establish operation on a real heat pump.
