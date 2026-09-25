import { SubAccountIsolationType, type SubAccountDetail } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { shortAddress } from "../../lib/format.js";
import { encodeSubAccountHookMetadata } from "../../lib/sub-account-metadata.js";
import { isIsolationCompatibleWithSolver, isolationLabel } from "../../lib/sub-account.js";
import { affiliateAddress, symmioCoreAddress } from "../../sdk/chain.js";
import { useCreateSubAccount, useDeleteSubAccount, useEditAccountName } from "../../sdk/mutations.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Field } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { SearchLine } from "../../ui/search-line.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useToast } from "../toast.js";

type Item = { kind: "account"; account: SubAccountDetail } | { kind: "create" };
type Mode = "list" | "create" | "rename" | "confirm-delete";

/** Manage sub-accounts: select, create, rename, and delete. */
export function SubAccountSheet({ active }: { active: boolean }) {
  const { config, chainId, solverId } = useSdkScope();
  const { list, subAccount, select, refetch } = useSubAccount();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const create = useCreateSubAccount();
  const rename = useEditAccountName();
  const remove = useDeleteSubAccount();

  const [mode, setMode] = useState<Mode>("list");
  const [name, setName] = useState("");
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<SubAccountDetail | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const defaultIsolation =
    solverId === "rasa" ? SubAccountIsolationType.CUSTOM : SubAccountIsolationType.MARKET_DIRECTION;
  const singleVAMode = defaultIsolation === SubAccountIsolationType.MARKET_DIRECTION;
  const createForm = useFormNav(2, active && mode === "create", (row) => row === 0);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (account) => account.name.toLowerCase().includes(needle) || account.accountAddress.toLowerCase().includes(needle),
    );
  }, [list, query]);

  // The create row is an action, not data, so it survives the filter — a search
  // that matches nothing is exactly when you want to make the account.
  const items: Item[] = [...matches.map((account) => ({ kind: "account" as const, account })), { kind: "create" }];
  const selectedItem = items[Math.max(0, Math.min(index, items.length - 1))];

  // Narrowing the list under a stale index would leave the caret on a row the
  // user can no longer see; fzf-style, every keystroke re-homes to the top.
  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    if (create.isSuccess) {
      toast.push("success", "Sub-account created");
      refetch();
      setMode("list");
      setName("");
    }
  }, [create.isSuccess, toast, refetch]);
  useEffect(() => {
    if (rename.isSuccess) {
      toast.push("success", "Sub-account renamed");
      refetch();
      setMode("list");
      setName("");
    }
  }, [rename.isSuccess, toast, refetch]);
  useEffect(() => {
    if (remove.isSuccess) {
      toast.push("info", "Sub-account deleted");
      refetch();
      setMode("list");
      setTarget(undefined);
    }
  }, [remove.isSuccess, toast, refetch]);

  function submitCreate() {
    if (!name.trim() || create.isPending) return;
    create.mutate({
      affiliate: affiliateAddress(config, chainId),
      accountsData: [
        {
          name: name.trim(),
          metadata: encodeSubAccountHookMetadata(config.getSolver({ chainId, solverId }).address),
          symmioCore: symmioCoreAddress(config, chainId),
          isolationType: defaultIsolation,
          singleVAMode,
        },
      ],
    });
  }
  function submitRename() {
    if (!target || !name.trim() || rename.isPending) return;
    rename.mutate({ account: target.accountAddress, name: name.trim() });
  }
  function submitDelete() {
    if (!target || remove.isPending) return;
    remove.mutate({ subAccount: target.accountAddress });
  }

  function startCreate() {
    setName("");
    createForm.setRow(0);
    setMode("create");
  }
  function choose(item: Item) {
    if (item.kind === "create") {
      startCreate();
    } else {
      select(item.account.accountAddress);
      closeOverlay();
    }
  }

  useInput(
    (input) => {
      if (input === "/") {
        setSearching(true);
        return;
      }
      if (input === "n") {
        startCreate();
        return;
      }
      // Below here is per-account, so it needs a real account under the caret —
      // the create row has nothing to rename or delete.
      if (!selectedItem || selectedItem.kind !== "account") return;
      if (input === "r") {
        setTarget(selectedItem.account);
        setName(selectedItem.account.name);
        setMode("rename");
      } else if (input === "d" || input === "x") {
        setTarget(selectedItem.account);
        setMode("confirm-delete");
      }
    },
    { isActive: active && mode === "list" && !searching },
  );
  // While the search box has focus it owns every printable key, so the list's
  // own shortcuts stand down and this handler drives the caret instead.
  useInput(
    (input, key) => {
      if (key.upArrow) setIndex((current) => Math.max(0, current - 1));
      else if (key.downArrow) setIndex((current) => Math.min(items.length - 1, current + 1));
      else if (key.return) {
        setSearching(false);
        if (selectedItem) choose(selectedItem);
      } else if (key.backspace || key.delete) setQuery((current) => current.slice(0, -1));
      else if (!key.ctrl && !key.meta) {
        // A paste (or any fast burst) arrives as one multi-character chunk, so
        // this takes the whole string rather than a single key — searching by
        // address is unusable otherwise. Stripping control bytes keeps stray
        // escape sequences out of the query while leaving non-ASCII names.
        // eslint-disable-next-line no-control-regex
        const printable = input.replace(/[\x00-\x1F\x7F]/g, "");
        if (printable) setQuery((current) => current + printable);
      }
    },
    { isActive: active && mode === "list" && searching },
  );
  useInput(
    (_input, key) => {
      if (createForm.row === 1 && key.return) submitCreate();
    },
    { isActive: active && mode === "create" },
  );
  useInput((_input, key) => key.return && submitRename(), { isActive: active && mode === "rename" });
  useInput(
    (input) => {
      if (input === "y") submitDelete();
      else if (input === "n") {
        setMode("list");
        setTarget(undefined);
      }
    },
    { isActive: active && mode === "confirm-delete" },
  );

  if (mode === "create" || mode === "rename") {
    const editing = mode === "rename";
    const busy = editing ? rename.isPending : create.isPending;
    const error = editing ? rename.error : create.error;
    return (
      <Sheet
        title={editing ? "Rename sub-account" : "New sub-account"}
        subtitle={editing ? target?.name : "deployment-compatible trading model"}
      >
        <Field
          label="Name"
          value={name}
          onChange={setName}
          focused={editing || createForm.row === 0}
          placeholder="e.g. Terminal"
        />
        {!editing && (
          <Box flexDirection="column" gap={1} marginTop={1}>
            <KeyValue label="Isolation" value={isolationLabel(defaultIsolation)} />
            <KeyValue label="Single VA" value={singleVAMode ? "YES" : "N/A"} />
            <Text color={theme.faint}>
              {solverId === "rasa"
                ? "Rasa trades directly from a CUSTOM cross-margin sub-account."
                : "Enigma opens into market-and-direction Virtual Accounts."}
            </Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          {busy ? (
            <LoadingLine
              label={editing ? "Renaming (approve in your wallet)…" : "Creating (approve in your wallet)…"}
            />
          ) : (
            <Text color={editing || createForm.row === 1 ? theme.primaryBright : theme.faint}>
              {editing ? "⏎ save" : `${createForm.row === 1 ? `${glyph.caret} ` : "  "}Create  ⏎`} {glyph.dot} esc
              cancel
            </Text>
          )}
          {error != null && <ErrorLine message={(error as Error).message} />}
        </Box>
      </Sheet>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <Sheet title="Delete sub-account" subtitle={target ? shortAddress(target.accountAddress) : undefined}>
        <Box flexDirection="column">
          <Text color={theme.text}>
            Delete <Text bold>{target?.name}</Text>?
          </Text>
          <Box marginTop={1}>
            <Text color={theme.muted}>
              This is permanent. The sub-account must be empty — no balance, open positions, pending quotes, or Virtual
              Accounts — or the transaction reverts.
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {remove.isPending ? (
              <LoadingLine label="Deleting (approve in your wallet)…" />
            ) : (
              <Text>
                <Text color={theme.negative} bold>
                  {" y "}
                </Text>
                <Text color={theme.faint}> delete {glyph.dot} </Text>
                <Text color={theme.primaryBright} bold>
                  {" n "}
                </Text>
                <Text color={theme.faint}> cancel</Text>
              </Text>
            )}
            {remove.error != null && <ErrorLine message={(remove.error as Error).message} />}
          </Box>
        </Box>
      </Sheet>
    );
  }

  return (
    <Sheet title="Sub-accounts" subtitle={query ? `${matches.length}/${list.length} owned` : `${list.length} owned`}>
      <SearchLine query={query} searching={searching} escLabel="close" />
      {query !== "" && matches.length === 0 && (
        <Box marginBottom={1}>
          <Text color={theme.faint}>No sub-accounts match.</Text>
        </Box>
      )}
      <Menu
        items={items}
        index={index}
        setIndex={setIndex}
        active={active && !searching}
        mouseActive={active}
        emptyLabel="No sub-accounts yet."
        onSelect={choose}
        renderItem={(item, selected) => {
          if (item.kind === "create") {
            return <Text color={selected ? theme.primaryBright : theme.primary}>＋ New sub-account</Text>;
          }
          const isCurrent = item.account.accountAddress === subAccount;
          const compatible = isIsolationCompatibleWithSolver(item.account.isolationType, solverId);
          return (
            <Box justifyContent="space-between" width={60}>
              <Text color={selected ? theme.text : theme.muted}>
                {isCurrent ? `${glyph.check} ` : "  "}
                {item.account.name}
              </Text>
              <Text color={compatible ? theme.faint : theme.warning}>
                {compatible ? isolationLabel(item.account.isolationType) : "incompatible"}
              </Text>
            </Box>
          );
        }}
      />
      <Box marginTop={1}>
        <Box flexDirection="column">
          <Text color={theme.faint}>
            n new {glyph.dot} r rename {glyph.dot} d delete
          </Text>
          <Text color={theme.faint}>
            {solverId} trading requires {isolationLabel(defaultIsolation)} isolation.
          </Text>
        </Box>
      </Box>
    </Sheet>
  );
}
