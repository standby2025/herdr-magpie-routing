# herdr-magpie-routing

A live **Routing** panel for [herdr](https://github.com/herdrdev/herdr) that shows what [magpie](https://github.com/yetone/magpie) is routing right now: which agent sent a request, which provider or account answered, and the recent calls. It reads magpie's own trace feed, the one its Routing page uses.

一个 herdr 的 **Routing** 面板 mod,实时展示 [magpie](https://github.com/yetone/magpie) 的路由:哪个 agent 发的请求、由哪个供应商/账号应答、最近的调用记录。数据来自 magpie 自己的 trace 接口。

- agent → magpie → account wires; dashed and animated while a request is out
- a dot flies out and back on each live leg, a pulsing dot marks live rows
- recent calls with model, provider, tries, tokens, time and tok/s
- shows "offline" when magpie isn't answering

## Requirements

- herdr app (the `herdr-app` CLI on your PATH)
- magpie running locally with its gateway at `127.0.0.1:3425` (the default)
- `python3` (only for the button patch)

## Install

```sh
git clone https://github.com/<you>/herdr-magpie-routing && cd herdr-magpie-routing
./install.sh
```

This installs the mod to `~/.config/herdr-app/mods/routing`, then clones herdr's `tabs` mod and `main` layout (yours, never updated by herdr) and adds a **Routing** button right of Files / Changes. It switches you to the cloned layout `my-layout`; `ctrl-shift-l` cycles layouts.

Only want the panel, no layout changes:

```sh
./install.sh --mod-only
herdr-app do pane.split '{"direction":"right","mod":"routing"}'
```

No restart needed: herdr hot-reloads mods. Herdr's shipped files are read-only, which is why the button needs the clone.

## Limits

- Wires are straight lines and the moving dot is a plain dot, not magpie's bird.
- Only the last try of a request is drawn; failover between accounts isn't shown yet.
- The model chip shows the model asked for (e.g. a group), not the member that answered.
- At most 4 agents and 5 accounts are drawn.
- Only magpie's gateway address `127.0.0.1:3425` is read; edit `GATEWAY` in `routing/main.js` for another.

## Credits

The idea and look follow magpie's Routing page (MIT). The bird icon here is drawn for this project. MIT licensed.
