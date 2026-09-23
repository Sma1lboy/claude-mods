// The layout of settings.example.json: a ccstatusline config with cost and cache appended.
export default {
  "version": 4,
  "lines": [
    [
      {
        "id": "eb4d773c-5ca3-4380-a270-45d5ac44fc5b",
        "type": "git-worktree"
      },
      {
        "id": "2",
        "type": "separator"
      },
      {
        "id": "5",
        "type": "git-branch",
        "color": "magenta"
      },
      {
        "id": "4",
        "type": "separator"
      },
      {
        "id": "3",
        "type": "context-length",
        "color": "brightBlack"
      },
      {
        "id": "b113edc1-0a8d-42de-9a1d-791ac17a2751",
        "type": "separator"
      },
      {
        "id": "1",
        "type": "output-speed",
        "color": "cyan"
      },
      {
        "id": "6",
        "type": "separator"
      },
      {
        "id": "7",
        "type": "git-changes",
        "color": "yellow"
      },
      {
        "id": "ul-s1",
        "type": "separator"
      },
      {
        "id": "ul-cost",
        "type": "session-cost",
        "color": "green"
      },
      {
        "id": "ul-s2",
        "type": "separator"
      },
      {
        "id": "ul-cache",
        "type": "cache-timer",
        "color": "brightCyan"
      },
      {
        "id": "ul-s3",
        "type": "separator"
      },
      {
        "id": "ul-hit",
        "type": "cache-hit-rate",
        "color": "green"
      },
      {
        "id": "ul-s4",
        "type": "separator"
      },
      {
        "id": "ul-miss",
        "type": "usageline-cache-miss",
        "color": "yellow"
      }
    ],
    [],
    []
  ],
  "flexMode": "full-minus-40",
  "compactThreshold": 60,
  "colorLevel": 2,
  "inheritSeparatorColors": false,
  "globalBold": false,
  "minimalistMode": false,
  "powerline": {
    "enabled": false,
    "separators": [
      ""
    ],
    "separatorInvertBackground": [
      false
    ],
    "startCaps": [],
    "endCaps": [],
    "autoAlign": false,
    "continueThemeAcrossLines": false
  }
}
