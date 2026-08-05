import ControllerExtension from 'sap/ui/core/mvc/ControllerExtension';
import ExtensionAPI from 'sap/fe/templates/ObjectPage/ExtensionAPI';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Dialog from 'sap/m/Dialog';
import Fragment from 'sap/ui/core/Fragment';

type Appointment = {
	patient_ID: string;
	typeAppointment_ID: string;
	block_ID: string;
	title: string;
	description: string;
	beginDate: Date | null;
	endDate: Date | null;
	startDate: string;
	endDate2: string;
	beginTime: string;
	endTime: string;
}

/**
 * @namespace santos.therapists.ext.controller
 * @controller
 */
export default class ObjectPage extends ControllerExtension<ExtensionAPI> {
	static overrides = {
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf santos.therapists.ext.controller.ObjectPage
		 */
		onInit(this: ObjectPage) {
			// you can access the Fiori elements extensionAPI via this.base.getExtensionAPI
			const model = this.base.getExtensionAPI().getModel();
			this.initAppointmentModel();
		}
	}

	private dialog: Dialog;

	private initAppointmentModel(): void {
		const data: Appointment = {
			patient_ID: "",
			typeAppointment_ID: "",
			block_ID: "",
			title: "",
			description: "",
			beginDate: null,
			endDate: null,
			startDate: "",
			endDate2: "",
			beginTime: "",
			endTime: ""
		};

		this.base.getView().setModel(new JSONModel(data), "formModel");
	}

	public async onNewAppointmentButtonPress(): Promise<void> {
		const view = this.base.getView();

		this.dialog ??= await Fragment.load({
			id: view.getId(),
			name: "santos.therapists.ext.fragment.Form",
			controller: this,
		}) as Dialog;

		view.addDependent(this.dialog);

		// this.dialog.bindElement({ path: "/", model: "" });
		this.dialog.open();
	}

	public onCancelButtonPress(): void {
		if (this.dialog) {
			this.dialog.close();
		}
	}
}