import ControllerExtension from 'sap/ui/core/mvc/ControllerExtension';
import ExtensionAPI from 'sap/fe/templates/ObjectPage/ExtensionAPI';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Dialog from 'sap/m/Dialog';
import Control from 'sap/ui/core/Control';
import Fragment from 'sap/ui/core/Fragment';
import { DatePicker$ChangeEvent } from 'sap/m/DatePicker';
import { ComboBox$ChangeEvent } from 'sap/m/ComboBox';
import SinglePlanningCalendar, { SinglePlanningCalendar$AppointmentDropEvent, SinglePlanningCalendar$AppointmentSelectEvent } from 'sap/m/SinglePlanningCalendar';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import ODataModel from 'sap/ui/model/odata/v4/ODataModel';
import Filter from 'sap/ui/model/Filter';
import FilterOperator from 'sap/ui/model/FilterOperator';
import MessageBox from 'sap/m/MessageBox';
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Popover from 'sap/m/Popover';
import CalendarAppointment from 'sap/ui/unified/CalendarAppointment';
import Context from 'sap/ui/model/odata/v4/Context';
import ListItem from 'sap/ui/core/ListItem';
import MessageToast from 'sap/m/MessageToast';
import { Button$PressEvent } from 'sap/ui/commons/Button';
import DateFormat from 'sap/ui/core/format/DateFormat';

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

		// XXX is the timezone offset in the format ±hh:mm, which is required for Edm.DateTimeOffset.
		return DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ssXXX" }).format(localDate);
	}

	private formatDateToString(date: Date): string {
		return DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).format(date);
	}

	/** Finds the VH_Blocks entry whose time range contains the given time ("HH:mm:ss") and returns its ID. */
	private async findBlockIdByTime(time: string): Promise<string | undefined> {
		const model = this.base.getView().getModel() as ODataModel;
		const binding = model.bindList("/VH_Blocks", undefined, undefined, new Filter({
			filters: [
				new Filter("beginTime", FilterOperator.LE, time),
				new Filter("endTime", FilterOperator.GT, time)
			],
			and: true
		}));

		const [block] = await binding.requestContexts(0, 1);
		return block?.getProperty("ID") as string | undefined;
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

	/* ################### EDIT DIALOG ################### */

	public async onEditButtonPopoverPress(): Promise<void> {
		const popover = this.fragments["Details"] as Popover | undefined;
		const context = popover?.getBindingContext("popover") as Context | undefined;
		if (!context) return;

		popover?.close();
		this.editContext = context;
		
		const appointmentData = context.getObject() as Appointment;
		this.getFormModel().setData(appointmentData);

		const dialog = await this.loadFragment<Dialog>("Edit");
		dialog.setTitle(this.getText("editAppointment"));
		dialog.open();
	}

	/* ################### SAVE/CANCEL DIALOG ################### */

	public async onSaveButtonPress(): Promise<void> {
		const context = this.editContext;
		if (!context) return;

		const appointment = this.getFormModel().getData() as Appointment;

		try {
			const appointmentProperties = Object.keys(this.createEmptyAppointment()) as (keyof Appointment)[];
			await Promise.all(
				appointmentProperties.map((propertyName) => context.setProperty(propertyName, appointment[propertyName]))
			);

			// refresh navigation properties so the popover (e.g. block/timeText) reflects the new values immediately
			await context.requestSideEffects([
				{ $NavigationPropertyPath: "patient" },
				{ $NavigationPropertyPath: "typeAppointment" },
				{ $NavigationPropertyPath: "block" }
			]);

			(this.fragments["Edit"] as Dialog)?.close();
			this.editContext = null;
			this.resetForm();
			MessageToast.show(this.getText("appointmentUpdatedSuccessfully"));
		} catch (error) {
			MessageBox.error(this.getText("errorUpdatingAppointment"), {
				details: error instanceof Error ? error.message : String(error)
			});
		}
	}

	public onCancelEditButtonPress(): void {
		(this.fragments["Edit"] as Dialog)?.close();
		this.editContext = null;
		this.resetForm();
	}

	public onShowMorePress(event: Button$PressEvent): void {
		const source = event.getSource();
		const context = source.getBindingContext("popover") as Context;
		if (!context) return;

		const appointmentKey = context.getProperty("ID");
		const IsActiveEntity = context.getProperty("IsActiveEntity");
		const therapistKey = this.base.getView()?.getBindingContext()?.getProperty("ID");

		(this.fragments["Details"] as Popover)?.close();

		this.base.getExtensionAPI().getRouting().navigateToRoute("AppointmentsSetAppointmentsPage", {
			TherapistsSetKey: therapistKey,
			toAppointmentsKey: appointmentKey,
			boolean1: IsActiveEntity,
			boolean2: IsActiveEntity
		});
	}

	public async onAppointmentDrop(event: SinglePlanningCalendar$AppointmentDropEvent): Promise<void> {
		const appointment = event.getParameter("appointment") as CalendarAppointment;
		const context = appointment?.getBindingContext() as Context | undefined;
		if (!context) return;

		const newStartDateTime = event.getParameter("startDate") as Date;
		const newEndDateTime = event.getParameter("endDate") as Date;
		const beginDate = this.formatDateToString(newStartDateTime);

		// Month view has no time granularity, so keep the appointment's original time values.
		const calendar = event.getSource() as SinglePlanningCalendar;
		const isMonthView = calendar?.getSelectedView()?.includes("Month") as boolean;
		const beginTime = isMonthView
			? context.getProperty("beginTime") as string
			: newStartDateTime.toTimeString().split(" ")[0];
		const endTime = isMonthView
			? context.getProperty("endTime") as string
			: newEndDateTime.toTimeString().split(" ")[0];

		const blockId = await this.findBlockIdByTime(beginTime);

		context.setProperty("beginDate", beginDate);
		context.setProperty("endDate", beginDate);
		context.setProperty("beginTime", beginTime);
		context.setProperty("endTime", endTime);

		// Update the calendar slot fields the appointment is bound to, so the binding refreshes on its own.
		context.setProperty("startDate", this.combineDateAndTime(beginDate, beginTime));
		context.setProperty("endDate2", this.combineDateAndTime(beginDate, endTime));

		if (blockId) {
			context.setProperty("block_ID", blockId);
			// Refresh the block navigation property so the popover (block/timeText) reflects the new block immediately.
			await context.requestSideEffects([{ $NavigationPropertyPath: "block" }]);
		}

		(this.fragments["Details"] as Popover)?.close();
	}
}