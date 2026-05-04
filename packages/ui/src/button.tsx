interface Props {
  label: string;
}

export function Button(props: Props) {
  return (
    <button
      type="button"
      style={{
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 14,
        fontWeight: 600,
        border: "1px solid #27272a",
        background: "#18181b",
        color: "#fafafa",
        cursor: "pointer",
      }}
    >
      {props.label}
    </button>
  );
}
