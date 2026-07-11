import { Children, isValidElement, type ReactNode } from "react";

/**
 * One visual grammar for documenting a method's inputs and outputs.
 *
 * `<Properties>` wraps a list of `<Property>` rows (used for **Parameters**).
 * `<Returns>` shows the return type as a badge in a boxed panel. For an object /
 * struct return it wraps the same `<Property>` rows describing each field; for a
 * scalar return (`bigint`, `Hash`, …) it renders the description passed as
 * children inside the same box — so both shapes read the same way.
 *
 * @example
 * ```mdx
 * ## Parameters
 *
 * <Properties>
 *   <Property name="user" type="Address" required>EOA to list.</Property>
 *   <Property name="limit" type="bigint" default="200n">Page size.</Property>
 * </Properties>
 *
 * ## Returns
 *
 * <Returns type="readonly SubAccountDetail[]">
 *   <Property name="owner" type="Address">Creator EOA.</Property>
 * </Returns>
 *
 * <Returns type="bigint">Raw collateral units. Format with `formatUnits`.</Returns>
 * ```
 */

interface TypeBadgeProps {
  type: string;
  href?: string;
}

function TypeBadge({ type, href }: TypeBadgeProps) {
  const badge = <code className="symm-props__type">{type}</code>;
  if (!href) {
    return badge;
  }
  return (
    <a className="symm-props__typelink" href={href}>
      {badge}
    </a>
  );
}

interface PropertyProps {
  /** Field or parameter name, rendered in monospace. */
  name: string;
  /** Type expression, rendered as a badge. */
  type: string;
  /** When set, the type badge links here — use for named SDK types. */
  typeHref?: string;
  /** Show a "required" chip. */
  required?: boolean;
  /** Show an "optional" chip. */
  optional?: boolean;
  /** Show a "default …" chip with this value. */
  default?: string;
  /** Description; supports inline MDX (prose, `code`, links). Optional. */
  children?: ReactNode;
}

/** A single input or output field. */
export function Property({ name, type, typeHref, required, optional, default: defaultValue, children }: PropertyProps) {
  const flags: ReactNode[] = [];
  if (required) {
    flags.push(
      <span key="req" className="symm-props__flag symm-props__flag--req">
        required
      </span>,
    );
  }
  if (defaultValue !== undefined) {
    flags.push(
      <span key="def" className="symm-props__flag symm-props__flag--def">
        default {defaultValue}
      </span>,
    );
  }
  if (optional) {
    flags.push(
      <span key="opt" className="symm-props__flag symm-props__flag--opt">
        optional
      </span>,
    );
  }
  return (
    <div className="symm-props__row">
      <div className="symm-props__head">
        <code className="symm-props__name">{name}</code>
        <TypeBadge type={type} href={typeHref} />
        {flags.length > 0 ? <span className="symm-props__flags">{flags}</span> : null}
      </div>
      {children ? <div className="symm-props__body">{children}</div> : null}
    </div>
  );
}

interface PropertiesProps {
  children: ReactNode;
}

/** Container for a set of `<Property>` rows — use for a method's parameters. */
export function Properties({ children }: PropertiesProps) {
  return <div className="symm-props">{children}</div>;
}

interface ReturnsProps {
  /** The return type expression, e.g. `readonly SubAccountDetail[]` or `bigint`. */
  type: string;
  /** When set, the type badge links here — use for named SDK types. */
  typeHref?: string;
  /** `<Property>` rows for a struct return, or the description text for a scalar return. */
  children?: ReactNode;
}

/** A method's return type: a boxed type badge, then either field rows (struct) or a description (scalar). */
export function Returns({ type, typeHref, children }: ReturnsProps) {
  const hasFields = Children.toArray(children).some((child) => isValidElement(child) && child.type === Property);
  return (
    <div className="symm-props symm-props--returns">
      <div className="symm-props__lead">
        <TypeBadge type={type} href={typeHref} />
      </div>
      {hasFields ? children : children ? <div className="symm-props__returnbody">{children}</div> : null}
    </div>
  );
}
