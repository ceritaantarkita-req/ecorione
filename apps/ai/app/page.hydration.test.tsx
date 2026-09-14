import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatPage from "./page";

describe("ChatPage session hydration", () => {
  it("tidak merender session id acak pada HTML server sebelum hydration client", () => {
    const html = renderToStaticMarkup(<ChatPage />);
    expect(html).toContain("sess_pending");
    expect(html).not.toMatch(
      /sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
  });
});
