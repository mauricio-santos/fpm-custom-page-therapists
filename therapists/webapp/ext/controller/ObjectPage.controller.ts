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
import ListItem from 'sap/ui/core/ListItem';

type Appointment = {
	patient_ID: string;
	typeAppointment_ID: string;
	block_ID: string;
	title: string;
	description: string;
	beginDate: string;
	endDate: string;
	startDate: string;
	endDate2: string;
	beginTime: string;
	endTime: string;
}

const FRAGMENT_NAMESPACE = "santos.therapists.ext.fragment";
const CALENDAR_ID = "fe::CustomSubSection::PlanningCalendar--idSinglePlanningCalendar";

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
			this.base.getView().setModel(new JSONModel(this.createEmptyAppointment()), "formModel");
		}
	}

	private readonly fragments: Partial<Record<string, Control>> = {};
	private editContext: Context | null = null;

	/* ################### HELPERS ################### */

	private createEmptyAppointment(): Appointment {
		return {
			patient_ID: "",
			typeAppointment_ID: "",
			block_ID: "",
			title: "",
			description: "",
			beginDate: "",
			endDate: "",
			startDate: "",
			endDate2: "",
			beginTime: "",
			endTime: ""
		};
	}

	private getFormModel(): JSONModel {
		return this.base.getView().getModel("formModel") as JSONModel;
	}

	private getText(key: string): string {
		const bundle = (this.base.getView().getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
		return bundle.getText(key) ?? key;
	}

	private resetForm(): void {
		this.getFormModel().setData(this.createEmptyAppointment());
	}

	private async loadFragment<T extends Control>(name: string): Promise<T> {
		const view = this.base.getView();

		this.fragments[name] ??= (await Fragment.load({
			id: view.getId(),
			name: `${FRAGMENT_NAMESPACE}.${name}`,
			controller: this
		})) as Control;

		view.addDependent(this.fragments[name]);
		return this.fragments[name] as T;
	}

	/** Combines an Edm.Date ("yyyy-MM-dd") with a time ("HH:mm:ss") into an Edm.DateTimeOffset string. */
	private combineDateAndTime(date: string, time: string): string {
		const localDate = new Date(`${date}T${time}`);
		if (isNaN(localDate.getTime())) return "";
		
		const offsetMinutes = -localDate.getTimezoneOffset();
		const sign = offsetMinutes >= 0 ? "+" : "-";
		const absMinutes = Math.abs(offsetMinutes);
		const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
		const offsetRemainder = String(absMinutes % 60).padStart(2, "0");

		return `${date}T${time}${sign}${offsetHours}:${offsetRemainder}`;
	}

	private formatDateToString(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");

		return `${year}-${month}-${day}`;
	}

	/** Recomputes the calendar slot (startDate/endDate2) whenever the date or the time block changes. */
	private updateCalendarSlot(): void {
		const formModel = this.getFormModel();
		const beginDate = formModel.getProperty("/beginDate") as string;
		const beginTime = formModel.getProperty("/beginTime") as string;
		const endTime = formModel.getProperty("/endTime") as string;

		if (!beginDate || !beginTime || !endTime) {
			formModel.setProperty("/startDate", "");
			formModel.setProperty("/endDate2", "");
			return;
		}

		formModel.setProperty("/startDate", this.combineDateAndTime(beginDate, beginTime));
		formModel.setProperty("/endDate2", this.combineDateAndTime(beginDate, endTime));
	}

	/* ################### CREATE AND CANCEL NEW APPOINTMENT ################### */

	public async onNewAppointmentButtonPress(): Promise<void> {
		this.resetForm();
		const dialog = await this.loadFragment<Dialog>("Form");
		dialog.open();
	}

	public onCancelButtonPress(): void {
		(this.fragments["Form"] as Dialog)?.close();
		this.resetForm();
	}

	public async onCreateButtonPress(): Promise<void> {
		const appointment = this.getFormModel().getData() as Appointment;
		const calendar = this.base.getExtensionAPI().byId(CALENDAR_ID) as SinglePlanningCalendar;
		const listBinding = calendar.getBinding("appointments") as ODataListBinding;

		try {
			await listBinding.create(appointment).created();
			MessageBox.success(this.getText("appointmentCreatedSuccessfully"));
			(this.fragments["Form"] as Dialog)?.close();
			this.resetForm();
		} catch (error) {
			MessageBox.error(this.getText("errorCreatingAppointment"), {
				details: error instanceof Error ? error.message : String(error)
			});
		}
	}

	/* ################### DATE PICKER & VH BLOCKS COMBO BOX EVENT ################### */

	public onDatePickerChange(event: DatePicker$ChangeEvent): void {
		const selectedDate = event.getSource().getDateValue();
		const formModel = this.getFormModel();
		const beginDate = selectedDate ? this.formatDateToString(selectedDate) : "";

		if (!beginDate) {
			formModel.setProperty("/block_ID", "");
			formModel.setProperty("/beginTime", "");
			formModel.setProperty("/endTime", "");
			return;
		}

		formModel.setProperty("/beginDate", beginDate);
		formModel.setProperty("/endDate", beginDate);

		this.updateCalendarSlot();
	}

	public onVhBlocksComboBoxChange(event: ComboBox$ChangeEvent): void {
		const selectedItem = event.getSource().getSelectedItem() as ListItem | null;
		const formModel = this.getFormModel();

		if (!selectedItem) {
			formModel.setProperty("/beginTime", "");
			formModel.setProperty("/endTime", "");
			this.updateCalendarSlot();
			return;
		}

		const [beginTime, endTime] = selectedItem.getAdditionalText().split("  - ");
		formModel.setProperty("/beginTime", beginTime);
		formModel.setProperty("/endTime", endTime);

		this.updateCalendarSlot();
	}


	/* ################### DETAILS POPOVER ################### */

	public async onAppointmentSelect(event: SinglePlanningCalendar$AppointmentSelectEvent): Promise<void> {
		const appointment = event.getParameter("appointment") as CalendarAppointment;
		const context = appointment?.getBindingContext() as Context | undefined;
		if (!context) return;

		const popover = await this.loadFragment<Popover>("Details");
		popover.setModel(this.base.getView().getModel(), "popover");
		popover.setBindingContext(context, "popover");

		const domRef = appointment.getDomRef() as HTMLElement; // need to use the DOM reference of the appointment to open the popover at the correct position
		popover.openBy(domRef);
	}
}