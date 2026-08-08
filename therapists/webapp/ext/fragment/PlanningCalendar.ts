import ExtensionAPI from 'sap/fe/core/ExtensionAPI';

/**
 * Generated event handler.
 *
 * @param this reference to the 'this' that the event handler is bound to.
 * @param event the event object provided by the event provider.
 */
export function formatAppointmentType(this: ExtensionAPI, status: string): string {
    /**
         * Type01 - Orange
         * Type02 - Red
         * Type03 - Light red
         * Type04 - Lighter red
         * Type05 - Violet
         * Type06 - Blue
         * Type07 - Light green
         * Type08 - Green
         * Type09 - Gray
         * Type10 - Purple
     */
    
    switch (status) {
        case "OnHold": return "Type01";
        case "Confirmed": return "Type08";
        default: return "Type02";
    }
}