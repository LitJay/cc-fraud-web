import swal from "sweetalert";

export const enum AlertMode {
  YesOrNo = 0,
  ConfirmOrCancel,
  Error,
  Success,
  NetworkError,
}

export type AlertDialogCommand = {
  mode: AlertMode | null;
  text?: string | null;
  callback?: () => void;
};

let isAlertShowing = false;
let alertQueue: AlertDialogCommand[] = [];

const processQueue = () => {
  isAlertShowing = false;

  if (alertQueue.length > 0) {
    const nextAlert = alertQueue.shift();
    if (nextAlert) {
      showAlert(nextAlert);
    }
  }
};

const showAlert = (command: AlertDialogCommand) => {
  if (isAlertShowing) {
    alertQueue.push(command);
    console.log("Alert added to queue. Current queue:", alertQueue);
    return;
  }

  isAlertShowing = true;

  if (command.mode === AlertMode.NetworkError) {
    swal({
      title: "Network Error",
      text:
        command.text ||
        "Connection lost. Please check your network connection.",
      icon: "error",
      buttons: {
        retry: {
          text: "Retry Connection",
          value: true,
          visible: true,
          className: "swal-button--retry",
        },
      },
      closeOnClickOutside: false,
    }).then((value) => {
      if (value) {
        command.callback?.();
      }
      processQueue();
    });
  } else if (command.mode === AlertMode.ConfirmOrCancel) {
    swal({
      title: `${command.text}`,
      icon: "warning",
      buttons: {
        cancel: {
          text: "Cancel",
          value: null,
          visible: true,
        },
        confirm: {
          text: "Confirm",
          value: true,
          visible: true,
          className: "swal-button--danger",
        },
      },
      dangerMode: true,
      closeOnClickOutside: false,
    }).then((value) => {
      if (value) {
        command.callback?.();
      }
      processQueue();
    });
  } else if (command.mode === AlertMode.Success) {
    swal({
      title: `${command.text}`,
      icon: "success",
      buttons: {
        ok: {
          text: "OK",
          value: true,
          visible: true,
        },
      },
      closeOnClickOutside: false,
    }).then(() => {
      command.callback?.();
      processQueue();
    });
  } else if (command.mode === AlertMode.YesOrNo) {
    swal({
      title: `${command.text}`,
      icon: "warning",
      buttons: {
        no: {
          text: "No",
          value: null,
          visible: true,
        },
        yes: {
          text: "Yes",
          value: true,
          visible: true,
          className: "swal-button--danger",
        },
      },
      dangerMode: true,
      closeOnClickOutside: false,
    }).then((value) => {
      if (value) {
        command.callback?.();
      }
      processQueue();
    });
  } else if (command.mode === AlertMode.Error) {
    swal({
      title: `${command.text}`,
      icon: "error",
      buttons: {
        ok: {
          text: "OK",
          value: true,
          visible: true,
        },
      },
      closeOnClickOutside: false,
    }).then(() => {
      command.callback?.();
      processQueue();
    });
  }
};

export const clearAlertQueue = () => {
  alertQueue = [];
  isAlertShowing = false;
};

export const GeneralAlert = (command: AlertDialogCommand) => {
  showAlert(command);
};

export default GeneralAlert;
