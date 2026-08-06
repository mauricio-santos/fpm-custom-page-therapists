import ControllerExtension from 'sap/ui/core/mvc/ControllerExtension';
import ExtensionAPI from 'sap/fe/templates/ObjectPage/ExtensionAPI';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Dialog from 'sap/m/Dialog';
import Control from 'sap/ui/core/Control';
import Fragment from 'sap/ui/core/Fragment';
import { DatePicker$ChangeEvent } from 'sap/m/DatePicker';
import { ComboBox$ChangeEvent } from 'sap/m/ComboBox';
import SinglePlanningCalendar, { SinglePlanningCalendar$AppointmentSelectEvent } from 'sap/m/SinglePlanningCalendar';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import MessageBox from 'sap/m/MessageBox';
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Popover from 'sap/m/Popover';
import CalendarAppointment from 'sap/ui/unified/CalendarAppointment';
import Context from 'sap/ui/model/odata/v4/Context';

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
	private popoverDetails: Popover;

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
			this.initAppointmentModel();
		}
	}

	public onDatePickerChange(event: DatePicker$ChangeEvent): void {
		const datePicker = event.getSource();
		const selectedDate = datePicker.getDateValue();
		const formModel = this.base.getView().getModel("formModel") as JSONModel;

		if (!selectedDate) {
			formModel.setProperty("/block_ID", "");
			formModel.setProperty("/endDate", null);
			formModel.setProperty("/beginTime", null);
			formModel.setProperty("/endTime", null);
			return;
		}

		formModel.setProperty("/selectedDate", selectedDate);

		const formattedDate = [
			selectedDate.getFullYear(),
			String(selectedDate.getMonth() + 1).padStart(2, "0"),
			String(selectedDate.getDate()).padStart(2, "0")
		].join("-");

		formModel.setProperty("/beginDate", formattedDate);
		formModel.setProperty("/endDate", formattedDate);
	}

	public onVhBlocksComboBoxChange(event: ComboBox$ChangeEvent): void {
		const item = event.getSource().getSelectedItem();
		const formModel = this.base.getView()?.getModel("formModel") as JSONModel;

		if (!item) {
			formModel.setProperty("/beginTime", null);
			formModel.setProperty("/endTime", null);
			return;
		}

		const additionalText = item.getProperty("additionalText") as string;
		const [beginTime, endTime] = additionalText.split("  - ");

		formModel.setProperty("/beginTime", beginTime);
		formModel.setProperty("/endTime", endTime);

		const selectedDate = formModel.getProperty("/selectedDate") as Date;
		formModel.setProperty("/startDate",this.combineDateAndTime(selectedDate, beginTime));
		formModel.setProperty("/endDate2",this.combineDateAndTime(selectedDate, endTime));
		delete formModel.getData().selectedDate; // not contained in the OData entity, so we remove it before sending the data to the backend
	}

	private combineDateAndTime(dateValue: Date, timeValue: string): string {
		const [hours, minutes, seconds] = timeValue.split(":").map(Number);
		const date = new Date(dateValue);
		
		date.setHours(hours, minutes, seconds);

		return date.toISOString().replace(/\.\d{3}Z$/, "Z");;
	}

	public async onCreateButtonPress(): Promise<void> {
		const view = this.base.getView();
		const formModel = view.getModel("formModel") as JSONModel;
		const appointmentData = formModel.getData() as Appointment;
		const planningCalendar = this.base.getExtensionAPI().byId("fe::CustomSubSection::PlanningCalendar--idSinglePlanningCalendar") as SinglePlanningCalendar;
		const bindList = planningCalendar.getBinding("appointments") as ODataListBinding;
		const resourceBundle = (view.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;

		try {
			await bindList.create(appointmentData).created();
			MessageBox.success(resourceBundle.getText("appointmentCreatedSuccessfully") || "Appointment created successfully.");
			this.dialog.close();
			this.initAppointmentModel();
		} catch (error) {
			MessageBox.error(resourceBundle.getText("errorCreatingAppointment") || "Error on creating appointment:", {
				details: error instanceof Error ? error.message : String(error)
			});
		}
	}

	public async onAppointmentSelect(event: SinglePlanningCalendar$AppointmentSelectEvent): Promise<void> {
		const appointment = event.getParameter("appointment") as CalendarAppointment
		if (!appointment) return;

		const context = appointment.getBindingContext() as Context;
		if (!context) return;

		const view = this.base.getView();
		this.popoverDetails ??= await Fragment.load({
			id: view.getId(),
			name: "santos.therapists.ext.fragment.Details",
			controller: this,
		}) as Popover;

		view.addDependent(this.popoverDetails);
		this.popoverDetails.setModel(view.getModel(), "popover");
		this.popoverDetails.setBindingContext(context, "popover");

		const domRef = appointment.getDomRef() as HTMLElement; // need to cast to HTMLElement to satisfy the type requirement for openBy
		this.popoverDetails.openBy(domRef);
	}
}