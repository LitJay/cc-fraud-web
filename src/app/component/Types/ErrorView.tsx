import ErrorIcon from "@mui/icons-material/Error";

const ErrorView = ({ errorText = "Something went wrong" }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <ErrorIcon style={{ fontSize: 48, color: "black" }} />
      <p className=" mt-2">{errorText}</p>
    </div>
  );
};

export default ErrorView;
