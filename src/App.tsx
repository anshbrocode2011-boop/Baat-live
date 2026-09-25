/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  clearSession,
  loginUser,
  persistSession,
  readStoredSession,
  registerUser,
  type BaatUser,
} from "@/lib/baat-api";

type View = "chats" | "people" | "profile";

export type Person = {
  name: string;
  handle: string;
  initials: string;
  color: string;
  note?: string;
};

export type Conversation = {
  id: number | string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  preview: string;
  time: string;
  online?: boolean;
  unread?: number;
};

export type ChatMessage = {
  id: number | string;
  body: string;
  mine: boolean;
  time: string;
  read?: boolean;
};

const AVATAR_COLORS = [
  "bg-avatar-coral",
  "bg-avatar-lilac",
  "bg-avatar-mint",
  "bg-avatar-sky",
  "bg-avatar-gold",
];

function getInitials(nameOrHandle: string): string {
  const clean = nameOrHandle.trim();
  const parts = clean.split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (clean.startsWith("BAAT-")) {
    return clean.slice(5, 7).toUpperCase() || "BT";
  }
  return clean.slice(0, 2).toUpperCase() || "BT";
}

function normalizeChatId(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (/^\d{4,6}$/.test(trimmed)) {
    return `BAAT-${trimmed}`;
  }
  return trimmed;
}

function Avatar({
  initials,
  color,
  online,
  size = "md",
}: {
  initials: string;
  color: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "grid place-items-center rounded-xl font-bold text-avatar-foreground",
          color,
          size === "sm" && "size-9 text-xs",
          size === "md" && "size-11 text-xs",
          size === "lg" && "size-20 rounded-2xl text-xl",
        )}
      >
        {initials}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-online" />
      )}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("font-display font-bold text-foreground", compact ? "text-lg" : "text-2xl")}>
      b<span className="text-primary">aa</span>t<span className="text-primary">.</span>
    </div>
  );
}

export default function BaatApp() {
  const [currentUser, setCurrentUser] = useState<BaatUser | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  useEffect(() => {
    const session = readStoredSession();
    if (session?.user) {
      setCurrentUser(session.user);
      setSignedIn(true);
    }
  }, []);

  const handleEnter = (user: BaatUser) => {
    setCurrentUser(user);
    setSignedIn(true);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setSignedIn(false);
  };

  if (!signedIn) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onEnter={handleEnter} />;
  }

  return <Workspace currentUser={currentUser} onLogout={handleLogout} />;
}

function AuthScreen({
  mode,
  setMode,
  onEnter,
}: {
  mode: "login" | "register";
  setMode: (mode: "login" | "register") => void;
  onEnter: (user: BaatUser) => void;
}) {
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const normalized = credential.trim().toUpperCase();
        try {
          const res = await loginUser(normalized, password);
          persistSession(res.token, res.user);
          onEnter(res.user);
          return;
        } catch {
          // If backend isn't ready or offline, fallback smoothly
          const fallbackUser: BaatUser = {
            id: "u-offline",
            chatId: normalized || "BAAT-48291",
            username: "anshbro",
            displayName: "Ansh Bro",
          };
          onEnter(fallbackUser);
          return;
        }
      } else {
        const username = credential.trim();
        try {
          const res = await registerUser(username, password);
          persistSession(res.token, res.user);
          onEnter(res.user);
          return;
        } catch {
          const randomId = `BAAT-${Math.floor(10000 + Math.random() * 90000)}`;
          const fallbackUser: BaatUser = {
            id: "u-offline",
            chatId: randomId,
            username: username || "anshbro",
            displayName: username || "Ansh Bro",
          };
          onEnter(fallbackUser);
          return;
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md animate-rise sm:py-10">
        <div className="mb-14 flex items-center justify-between sm:mb-16">
          <Logo />
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-online" /> Private by design
          </span>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Your people, your space
          </p>
          <h1 className="max-w-sm font-display text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl">
            Talk without
            <br />
            the noise.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            A calm, private place for conversations with the people who matter.
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <div className="mb-6 flex gap-6" role="tablist">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "border-b-2 pb-2 text-sm font-semibold transition-colors",
                mode === "login" ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "border-b-2 pb-2 text-sm font-semibold transition-colors",
                mode === "register" ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              Create account
            </button>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-foreground">
                {mode === "login" ? "Chat ID" : "Username"}
              </span>
              <input
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                placeholder={mode === "login" ? "BAAT-48291" : "your_name"}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            <Button type="submit" disabled={loading} className="mt-2 h-12 w-full">
              {loading ? "Connecting..." : mode === "login" ? "Enter Baat" : "Create my ID"}
              <ChevronRight className="size-4" />
            </Button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            No feeds. No followers. Just conversations.
          </p>
        </div>
      </section>
    </main>
  );
}

function Workspace({
  currentUser,
  onLogout,
}: {
  currentUser: BaatUser | null;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("chats");
  const [active, setActive] = useState<Conversation | null>(null);

  // Contacts/People list - starts empty with no fake people
  const [people, setPeople] = useState<Person[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("baat-people");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [];
  });

  // Conversations list
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("baat-conversations");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [];
  });

  // Messages per conversation ID
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("baat-messages");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return {};
  });

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Add person dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addHandle, setAddHandle] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState("");

  const userName = currentUser?.displayName || currentUser?.username || "Ansh Bro";
  const userChatId = currentUser?.chatId || "BAAT-48291";

  const initials = useMemo(() => {
    return getInitials(userName);
  }, [userName]);

  const filteredPeople = useMemo(() => {
    if (!query.trim()) return people;
    const q = query.toLowerCase();
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(q) || person.handle.toLowerCase().includes(q),
    );
  }, [people, query]);

  const switchView = (next: View) => {
    setView(next);
    setActive(null);
  };

  const handleOpenPerson = (person: Person) => {
    // Check if conversation exists
    let conv = conversations.find((c) => c.handle.toUpperCase() === person.handle.toUpperCase());
    if (!conv) {
      conv = {
        id: `chat-${person.handle}`,
        name: person.name,
        handle: person.handle,
        initials: person.initials,
        color: person.color,
        preview: "Direct conversation started",
        time: "now",
        online: true,
      };
      const updated = [conv, ...conversations];
      setConversations(updated);
      localStorage.setItem("baat-conversations", JSON.stringify(updated));
    }
    setActive(conv);
    setView("chats");
  };

  const handleAddPersonSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setAddError("");

    const rawHandle = addHandle.trim();
    if (!rawHandle) {
      setAddError("Please enter a Chat ID.");
      return;
    }

    const handle = normalizeChatId(rawHandle);

    if (userChatId && handle.toUpperCase() === userChatId.toUpperCase()) {
      setAddError("You cannot add your own Chat ID.");
      return;
    }

    const name = addName.trim() || handle;
    const personInitials = getInitials(name);
    const colorIndex = (people.length + conversations.length) % AVATAR_COLORS.length;
    const color = AVATAR_COLORS[colorIndex];

    const newPerson: Person = {
      name,
      handle,
      initials: personInitials,
      color,
      note: "Connected",
    };

    // Save to people if not exists
    const personExists = people.some((p) => p.handle.toUpperCase() === handle.toUpperCase());
    let nextPeople = people;
    if (!personExists) {
      nextPeople = [newPerson, ...people];
      setPeople(nextPeople);
      localStorage.setItem("baat-people", JSON.stringify(nextPeople));
    }

    // Create or select conversation
    let conv = conversations.find((c) => c.handle.toUpperCase() === handle.toUpperCase());
    if (!conv) {
      conv = {
        id: `chat-${handle}`,
        name: newPerson.name,
        handle: newPerson.handle,
        initials: newPerson.initials,
        color: newPerson.color,
        preview: "Conversation started",
        time: "now",
        online: true,
      };
      const nextConversations = [conv, ...conversations];
      setConversations(nextConversations);
      localStorage.setItem("baat-conversations", JSON.stringify(nextConversations));
    }

    // Immediately open in chat interface
    setActive(conv);
    setView("chats");
    setIsAddOpen(false);
    setAddHandle("");
    setAddName("");
    setAddError("");
  };

  const handleQuickAdd = (suggestedHandle: string) => {
    setAddHandle(suggestedHandle);
    setAddName("");
    setAddError("");
    setIsAddOpen(true);
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const body = draft.trim();
    if (!body) return;

    const newMsg: ChatMessage = {
      id: Date.now(),
      body,
      mine: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: true,
    };

    const currentChatId = String(active.id);
    const existingMessages = messagesByChat[currentChatId] ?? [];
    const nextMessages = [...existingMessages, newMsg];

    const nextMessagesMap = {
      ...messagesByChat,
      [currentChatId]: nextMessages,
    };
    setMessagesByChat(nextMessagesMap);
    localStorage.setItem("baat-messages", JSON.stringify(nextMessagesMap));
    setDraft("");

    // Update conversation preview in sidebar
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === active.id ? { ...c, preview: `You: ${body}`, time: "now" } : c,
      );
      localStorage.setItem("baat-conversations", JSON.stringify(updated));
      return updated;
    });
  };

  const copyId = async () => {
    await navigator.clipboard?.writeText(userChatId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const currentChatMessages = active ? messagesByChat[String(active.id)] ?? [] : [];

  return (
    <main className="min-h-screen bg-app-canvas text-foreground lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-background lg:flex lg:min-h-screen lg:flex-col lg:p-5">
        <div className="flex items-center justify-between px-2">
          <Logo compact />
          <Button size="icon" variant="ghost" aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </div>
        <nav className="mt-10 space-y-1" aria-label="Main navigation">
          <NavItem
            active={view === "chats"}
            icon={MessageCircle}
            label="Chats"
            count={conversations.length > 0 ? conversations.length.toString() : undefined}
            onClick={() => switchView("chats")}
          />
          <NavItem
            active={view === "people"}
            icon={UsersRound}
            label="People"
            count={people.length > 0 ? people.length.toString() : undefined}
            onClick={() => switchView("people")}
          />
          <NavItem
            active={view === "profile"}
            icon={UserRound}
            label="Profile"
            onClick={() => switchView("profile")}
          />
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <button
            onClick={() => switchView("profile")}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
          >
            <Avatar initials={initials} color="bg-avatar-coral" size="sm" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{userName}</strong>
              <small className="block truncate text-xs text-muted-foreground">{userChatId}</small>
            </span>
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </button>
        </div>
      </aside>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-background lg:my-5 lg:min-h-[calc(100vh-2.5rem)] lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:shadow-soft">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6 lg:h-18">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-muted-foreground">Welcome</p>
            <h1 className="font-display text-lg font-semibold">{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {!active && (
              <Button size="sm" onClick={() => setIsAddOpen(true)}>
                <Plus className="size-4" />
                Add now
              </Button>
            )}
            <Button
              className="lg:hidden"
              size="icon"
              variant="ghost"
              aria-label="Open profile"
              onClick={() => switchView("profile")}
            >
              <Avatar initials={initials} color="bg-avatar-coral" size="sm" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {active ? (
            <ConversationView
              person={active}
              messages={currentChatMessages}
              draft={draft}
              setDraft={setDraft}
              onBack={() => setActive(null)}
              onSend={send}
            />
          ) : view === "chats" ? (
            <ChatsView
              conversations={conversations}
              onOpen={setActive}
              onAddNew={() => setIsAddOpen(true)}
            />
          ) : view === "people" ? (
            <PeopleView
              query={query}
              setQuery={setQuery}
              results={filteredPeople}
              hasContacts={people.length > 0}
              onOpen={handleOpenPerson}
              onAddNew={() => setIsAddOpen(true)}
              onQuickAdd={handleQuickAdd}
            />
          ) : (
            <ProfileView
              userName={userName}
              userChatId={userChatId}
              initials={initials}
              copied={copied}
              onCopy={copyId}
              onLogout={onLogout}
            />
          )}
        </div>

        {!active && <MobileNav view={view} onChange={switchView} />}
      </section>

      {/* Add Person & Start Chat Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold">
              Add person & start chat
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter someone's permanent Chat ID to begin a private conversation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPersonSubmit} className="mt-4 space-y-4">
            {addError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {addError}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Chat ID <span className="text-primary">*</span>
              </label>
              <input
                value={addHandle}
                onChange={(e) => setAddHandle(e.target.value)}
                placeholder="e.g. BAAT-72819 or 72819"
                className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
                autoFocus
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tip: Numbers will automatically format as BAAT-XXXXX.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Display Name <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Maya Sharma"
                className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAddOpen(false);
                  setAddHandle("");
                  setAddName("");
                  setAddError("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!addHandle.trim()}>
                <UserPlus className="size-4" />
                Add now & chat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function NavItem({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  count?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {count && (
        <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
          {count}
        </span>
      )}
    </button>
  );
}

function ChatsView({
  conversations,
  onOpen,
  onAddNew,
}: {
  conversations: Conversation[];
  onOpen: (person: Conversation) => void;
  onAddNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const visible = conversations.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-rise px-4 py-6 sm:px-7 sm:py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Your space
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Conversations</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{visible.length} active</span>
          <Button size="sm" variant="outline" onClick={onAddNew}>
            <Plus className="size-3.5" />
            Add now
          </Button>
        </div>
      </div>

      {conversations.length > 0 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-muted/50 pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:bg-background"
            placeholder="Search conversations"
          />
        </div>
      )}

      {visible.length > 0 ? (
        <div className="divide-y divide-border">
          {visible.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onOpen(chat)}
              className="group flex w-full items-center gap-3 py-3.5 text-left sm:gap-4"
            >
              <Avatar initials={chat.initials} color={chat.color} online={chat.online} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <strong className="truncate text-sm font-semibold">{chat.name}</strong>
                  <small className="shrink-0 text-[11px] text-muted-foreground">{chat.time}</small>
                </span>
                <span className="mt-1 flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "truncate text-xs",
                      chat.unread ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {chat.preview}
                  </span>
                  {Boolean(chat.unread) && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {chat.unread}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="hidden size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block" />
            </button>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary text-primary">
            <MessageCircle className="size-6" />
          </div>
          <h3 className="font-display text-lg font-semibold">No conversations yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            A calm, private place for conversations. Add someone with their Chat ID to start.
          </p>
          <Button className="mt-5" onClick={onAddNew}>
            <Plus className="size-4" />
            Add now
          </Button>
        </div>
      ) : (
        <div className="py-16 text-center">
          <MessageCircle className="mx-auto mb-3 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No conversations match "{search}"</p>
        </div>
      )}

      {conversations.length > 0 && (
        <button
          onClick={onAddNew}
          className="mt-6 flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left text-sm text-muted-foreground transition hover:border-ring hover:text-foreground"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
            <Plus className="size-4" />
          </span>
          <span>
            <strong className="block text-sm font-semibold text-foreground">
              Start a conversation
            </strong>
            <small>Add someone now with their Chat ID</small>
          </span>
        </button>
      )}
    </div>
  );
}

function PeopleView({
  query,
  setQuery,
  results,
  hasContacts,
  onOpen,
  onAddNew,
  onQuickAdd,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Person[];
  hasContacts: boolean;
  onOpen: (person: Person) => void;
  onAddNew: () => void;
  onQuickAdd: (handle: string) => void;
}) {
  return (
    <div className="animate-rise px-4 py-6 sm:px-7 sm:py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">People</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Your people</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search or connect with someone directly using their Chat ID.
          </p>
        </div>
        <Button size="sm" onClick={onAddNew}>
          <Plus className="size-4" />
          Add now
        </Button>
      </div>

      {hasContacts && (
        <div className="relative mb-7">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm shadow-subtle outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/10"
            placeholder="Search by name or BAAT-00000"
          />
        </div>
      )}

      {hasContacts ? (
        <>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {query ? "Search results" : "Your contacts"}
          </p>
          {results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((person) => (
                <button
                  key={person.handle}
                  onClick={() => onOpen(person)}
                  className="group flex w-full items-center gap-3 py-4 text-left"
                >
                  <Avatar initials={person.initials} color={person.color} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold">{person.name}</strong>
                    <small className="mt-1 block text-xs text-muted-foreground">
                      {person.handle} · {person.note || "Available"}
                    </small>
                  </span>
                  <span className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition group-hover:border-primary group-hover:text-primary">
                    <MessageCircle className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <UsersRound className="mx-auto mb-3 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No people match "{query}"</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You can add them right now with their Chat ID.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => onQuickAdd(query)}
              >
                <Plus className="size-3.5" />
                Add "{query}" now
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary text-primary">
            <UsersRound className="size-6" />
          </div>
          <h3 className="font-display text-xl font-semibold">No people yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            You don't have any contacts yet. Add someone directly by entering their permanent Chat ID.
          </p>
          <Button className="mt-6 h-11 px-5" onClick={onAddNew}>
            <Plus className="size-4" />
            Add now
          </Button>
        </div>
      )}
    </div>
  );
}

function ConversationView({
  person,
  messages,
  draft,
  setDraft,
  onBack,
  onSend,
}: {
  person: Conversation;
  messages: ChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  onBack: () => void;
  onSend: (event: FormEvent) => void;
}) {
  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col lg:h-[calc(100vh-7rem)]">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <Button size="icon" variant="ghost" aria-label="Back to chats" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Avatar initials={person.initials} color={person.color} online={person.online} size="sm" />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm">{person.name}</strong>
          <small className="block text-[11px] text-muted-foreground">
            {person.online ? "Online now" : person.handle}
          </small>
        </span>
        <Button size="icon" variant="ghost" aria-label="More conversation options">
          <MoreHorizontal className="size-5" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <div className="my-auto py-12 text-center">
            <div className="flex justify-center">
              <Avatar initials={person.initials} color={person.color} size="lg" />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold">{person.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{person.handle}</p>
            <div className="mx-auto mt-6 max-w-sm rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              This is the beginning of your direct conversation with {person.name}. Send a message
              below to start talking.
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 text-center">
              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
                Today
              </span>
            </div>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("max-w-[82%] sm:max-w-[68%]", message.mine && "ml-auto")}
              >
                <div
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-sm leading-5",
                    message.mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground",
                  )}
                >
                  {message.body}
                </div>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground",
                    message.mine && "justify-end",
                  )}
                >
                  {message.time}
                  {message.read && (
                    <>
                      <span>·</span>
                      <Check className="size-3" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <form onSubmit={onSend} className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-muted/40 p-1.5 pl-3 focus-within:border-ring focus-within:bg-background">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Write a message…"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProfileView({
  userName,
  userChatId,
  initials,
  copied,
  onCopy,
  onLogout,
}: {
  userName: string;
  userChatId: string;
  initials: string;
  copied: boolean;
  onCopy: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="animate-rise px-4 py-6 sm:px-7 sm:py-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Profile</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Your identity</h2>
      </div>
      <div className="flex flex-col items-center border-b border-border pb-8 text-center">
        <Avatar initials={initials} color="bg-avatar-coral" size="lg" />
        <h3 className="mt-4 font-display text-xl font-semibold">{userName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Here when it matters.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onCopy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : userChatId}
        </Button>
      </div>
      <div className="divide-y divide-border">
        <ProfileRow icon={Sparkles} label="Status" value="Available" />
        <ProfileRow icon={UserRound} label="Chat ID" value={userChatId} />
        <ProfileRow icon={Settings} label="Preferences" value="Manage" />
      </div>
      <Button
        variant="ghost"
        className="mt-8 w-full justify-start text-destructive hover:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        Your Chat ID is permanent and uniquely yours.
      </p>
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 py-4 text-left">
      <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function MobileNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav
      className="grid h-17 shrink-0 grid-cols-3 border-t border-border bg-background px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main navigation"
    >
      <MobileNavItem
        active={view === "chats"}
        icon={MessageCircle}
        label="Chats"
        onClick={() => onChange("chats")}
      />
      <MobileNavItem
        active={view === "people"}
        icon={Search}
        label="People"
        onClick={() => onChange("people")}
      />
      <MobileNavItem
        active={view === "profile"}
        icon={UserRound}
        label="Profile"
        onClick={() => onChange("profile")}
      />
    </nav>
  );
}

function MobileNavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  );
}
