sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"santos/therapists/test/integration/pages/TherapistsSetMain.gen"
], function (JourneyRunner, TherapistsSetMainGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('santos/therapists') + '/test/flp.html#app-preview',
        pages: {
			onTheTherapistsSetMainGenerated: TherapistsSetMainGenerated
        },
        async: true
    });

    return runner;
});

