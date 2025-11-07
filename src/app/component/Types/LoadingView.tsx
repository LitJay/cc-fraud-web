import ClipLoader from "react-spinners/ClipLoader";

const LoadingView = () => {
  const override: React.CSSProperties = {
    display: "block",
    margin: "10 auto",
  };
  // bg-red-200
  return (
    <div className="flex flex-1 h-full items-center justify-center">
      <ClipLoader
        cssOverride={override}
        size={50}
        color={"#cd2020"}
        loading={true}
        speedMultiplier={0.5}
        aria-label="Loading Spinner"
        data-testid="loader"
        autoFocus={false}
      />
    </div>
  );
};

export default LoadingView;
