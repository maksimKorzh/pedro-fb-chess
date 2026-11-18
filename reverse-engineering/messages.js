let messages = [
{
            "type": "send",
            "time": 1794993048.2894049,
            "opcode": 2,
            "data": "AmgRMjk0Njg5MjI2MjI3MDAxMjgAAAC8VjZjY1E0T2l3S2NYcmNtUUt5UVFfQmYwcFNyNnNoSmNIblF5eHQ1RjhnUS5leUpoYkdkdmNtbDBhRzBpT2lKSVRVRkRMVk5JUVRJMU5pSXNJbWx6YzNWbFpGOWhkQ0k2TVRjNU5EazVNekEwTlN3aWNHeGhlV1Z5WDJsa0lqb2lNamswTmpnNU1qSTJNakkzTURBeE1qZ2lMQ0p5WlhGMVpYTjBYM0JoZVd4dllXUWlPaUpvWld4c2J5SjkAAAAFZW5fR0IKRkJJR19DSEVTUwU1LjAuMRlsYXN0UG9wdXA9PTE3OTQ3NTIzMjAyMDQKBWNoZXNzAQAAAAAAAAAAAAE="
          },
          {
            "type": "receive",
            "time": 1794993048.5175428,
            "opcode": 2,
            "data": "AmgAAAAZbGFzdFBvcHVwPT0xNzk0OTkzMDQ4NDAwCgAAAAADw1EsFjI5NDY4OTIyNjIyNzAwMTI4LjYxNzkABABSAG8AbwBiAAAAAAOZCmYOY2hlc3MuZ2FtZTguaW8ABQBBAGQAbQBpAG4BGWh0dHBzOi8vY2hlc3NjZG4uZ2FtZTguaW8AAQAAAaHt7EtSAHgJAAAGAEgAYQB3AGEAaQBpAJEATABQAAEABgBBAGwAYQBzAGsAYQCRAEkAUAACAAYAQgBlAG4AZwBhAGwAiABFAFAAAwAFAE4AZQBwAGEAbACSAEkAUAAEAAYAQgByAGUAbQBlAG4AigBEAFAABQAEAFIAaQBnAGEAhABDAFAABgAHAEMAaABpAGMAYQBnAG8AfwBCAFAABwAFAEsAYQB6AGEAbgCEAEMAUAAIAAYATABvAG4AZABvAG4AfQBCAFAADwAAADIAAABkAAAA+gAAAfQAAAPoAAAJxAAAE4gAACcQAABhqAAAw1AAAYagAAPQkAAHoSAAD0JAAAAAAAAAD0JAAA=="
          },
          {
            "type": "send",
            "time": 1794993048.5269759,
            "opcode": 2,
            "data": "AZEFTG9iYnkAAAAFY2hlc3M="
          },
          {
            "type": "receive",
            "time": 1794993048.543844,
            "opcode": 2,
            "data": "Aag="
          },
          {
            "type": "receive",
            "time": 1794993048.751061,
            "opcode": 2,
            "data": "AZEAAAAKAAoACg=="
          },
          {
            "type": "send",
            "time": 1794993048.775322,
            "opcode": 2,
            "data": "AVtAAA=="
          },
          {
            "type": "send",
            "time": 1794993048.924345,
            "opcode": 2,
            "data": "AVoA"
          },
          {
            "type": "send",
            "time": 1794993048.9271488,
            "opcode": 2,
            "data": "Aa4FY2hlc3M="
          },
          {
            "type": "send",
            "time": 1794993048.929196,
            "opcode": 2,
            "data": "AusLTG9iYnkuY2hlc3M="
          },
          {
            "type": "receive",
            "time": 1794993049.0025768,
            "opcode": 2,
            "data": "AVsAAA=="
          },
          {
            "type": "receive",
            "time": 1794993049.153368,
            "opcode": 2,
            "data": "AVoAAABRJwAA0GYAAAcAAAH0AAACWAAAArwAAAMgAAADhAAAA+gAAAfQ"
          },
          {
            "type": "receive",
            "time": 1794993049.1554298,
            "opcode": 2,
            "data": "Aa4AAQVMb2JieQVMb2JieQAEAFMeowBuAGgAAAAAPwAAAAAAACVJAAAAAAAAAAAAAAAAAAAFuQoAAAAAAAAFqgAAAAAAAAYO"
          },
          {
            "type": "receive",
            "time": 1794993049.164108,
            "opcode": 2,
            "data": "AusAAAA="
          },
          {
            "type": "send",
            "time": 1794993049.196127,
            "opcode": 2,
            "data": "Aao="
          },
          {
            "type": "receive",
            "time": 1794993049.423295,
            "opcode": 2,
            "data": "AaoAAAAABQE="
          },
          {
            "type": "send",
            "time": 1794993063.530377,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993063.754057,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993070.263198,
            "opcode": 2,
            "data": "AoU="
          },
          {
            "type": "receive",
            "time": 1794993070.488523,
            "opcode": 2,
            "data": "AoUAAQAAAAAAAA95ETQwODY3MDM2OTgyODc5OTc0AAABojS81AAAHQBUAGgAYQBuAGsAcwBnAGkAdgBpAG4AZwAgAEYAZQBzAHQAaQB2AGEAbAAgADIAMAAyADYAIABXADQBNQB7ACAAIgBwAGgAbwB0AG8AIgA6ACAAIgBoAHQAdABwAHMAOgAvAC8AYwBkAG4ALgBnAGEAbQBlAHYAaAAuAG0AZQAvAHUAcABsAG8AYQBkAC8AZgBiAGkAZwAvAGMAaABlAHMAcwAvAHQAaABhAG4AawBzADEALgBwAG4AZwAiACwAIAAiAGcAdQBpAGQAZQAiADoAIAAiAGgAdAB0AHAAcwA6AC8ALwBjAGQAbgAuAGcAYQBtAGUAdgBoAC4AbQBlAC8AdQBwAGwAbwBhAGQALwBmAGIAaQBnAC8AYwBoAGUAcwBzAC8AZwB1AGkAZABlAF8AJAB0AHkAcABlACQAXwAkAGwAbwBjAGEAbABlACQALgBoAHQAbQBsAD8AdgAxACIALAAgACIAbQBhAHQAYwBoAC0AbQBhAGsAaQBuAGcAIgA6ACAAewAgACIAZAAiADoAIAAxADAALAAgACIAcwAiADoAIAAzADAAIAB9ACwAIAAiAG0AYQB0AGMAaAAiADoAIAB7ACAAIgBkAGUAbgBvAG0AaQBuAGEAdABpAG8AbgAiADoAIAAzACwAIAAiAG0AYQB0AGMAaABEAHUAcgBhAHQAaQBvAG4AIgA6ACAAIgA1ACIALAAgACIAdAB1AHIAbgBEAHUAcgBhAHQAaQBvAG4AIgA6ACAAIgAzADAAIgAsACAAIgBhAGMAYwBEAHUAcgBhAHQAaQBvAG4AIgA6ACAAIgAwACIALAAgACIAZgBpAHIAcwB0AFQAdQByAG4ARAB1AHIAYQB0AGkAbwBuACIAOgAgACIAOQAwACIAIAB9ACAAfQA="
          },
          {
            "type": "send",
            "time": 1794993078.53128,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993078.7530959,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993093.5340838,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993093.756343,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993108.534958,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993108.758576,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993123.5359778,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993123.76211,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993138.536748,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993138.760916,
            "opcode": 2,
            "data": "ASw="
          },
          {
            "type": "send",
            "time": 1794993148.9450948,
            "opcode": 2,
            "data": "AoERNDA4NjcwMzY5ODI4Nzk5NzQ="
          },
          {
            "type": "receive",
            "time": 1794993149.170276,
            "opcode": 2,
            "data": "AoEAAAAAAAAAD3kDRUxPETQwODY3MDM2OTgyODc5OTc0"
          },
          {
            "type": "receive",
            "time": 1794993149.173579,
            "opcode": 2,
            "data": "AokAAAAAAAAF3AAAAYwAAAAAAAAF3AAAAYwAAAAAAAAAAAAAAAAAAAu5AAYAQQBsAHYAYQByAG8AZwAAADdodHRwczovL2NoZXNzY2RuLmdhbWU4LmlvL3VwbG9hZC91c2Vycy8xODIvMTMxMjYxODIucG5nAAAAAAAAC7cABgQhBDUEQAQzBDUEOQBuAAAARGh0dHBzOi8vY2hlc3NjZG4uZ2FtZTguaW8vdXBsb2FkL3VzZXJzLzI5Ni80NzQ1NDI5Ni5wbmc/dD0xNzcyNjA5Mjg1AAAAAAAAAAA="
          },
          {
            "type": "send",
            "time": 1794993149.509202,
            "opcode": 2,
            "data": "AoQB"
          },
          {
            "type": "receive",
            "time": 1794993149.731108,
            "opcode": 2,
            "data": "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ZQB2AGgALgBtAGUALwB1AHAAbABvAGEAZAAvAGYAYgBpAGcALwBjAGgAZQBzAHMALwBnAHUAaQBkAGUAXwAkAHQAeQBwAGUAJABfACQAbABvAGMAYQBsAGUAJAAuAGgAdABtAGwAPwB2ADEAIgAsACAAIgBtAGEAdABjAGgALQBtAGEAawBpAG4AZwAiADoAIAB7ACAAIgBkACIAOgAgADEAMAAsACAAIgBzACIAOgAgADMAMAAgAH0ALAAgACIAbQBhAHQAYwBoACIAOgAgAHsAIAAiAGQAZQBuAG8AbQBpAG4AYQB0AGkAbwBuACIAOgAgADMALAAgACIAbQBhAHQAYwBoAEQAdQByAGEAdABpAG8AbgAiADoAIAAiADUAIgAsACAAIgB0AHUAcgBuAEQAdQByAGEAdABpAG8AbgAiADoAIAAiADMAMAAiACwAIAAiAGEAYwBjAEQAdQByAGEAdABpAG8AbgAiADoAIAAiADAAIgAsACAAIgBmAGkAcgBzAHQAVAB1AHIAbgBEAHUAcgBhAHQAaQBvAG4AIgA6ACAAIgA5ADAAIgAgAH0AIAB9AQAAAAAAyEomAAYAQQBsAHYAYQByAG8AAAA3aHR0cHM6Ly9jaGVzc2Nkbi5nYW1lOC5pby91cGxvYWQvdXNlcnMvMTgyLzEzMTI2MTgyLnBuZwBnAYwAAAAAAAAF3AAAAQE="
          },
          {
            "type": "send",
            "time": 1794993161.0377579,
            "opcode": 2,
            "data": "AS0="
          },
          {
            "type": "receive",
            "time": 1794993161.266342,
            "opcode": 2,
            "data": "ASw="
          }
]

function base64ToHex(base64) {
  return [...atob(base64)]
    .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function hexToAscii(hex) {
  return hex.match(/.{1,2}/g)
    .map(byte => String.fromCharCode(parseInt(byte, 16)))
    .join('');
}

for (let msg of messages) {
    console.log(msg.type + "\t\t" + base64ToHex(msg.data) + "\t\t" + hexToAscii(base64ToHex(msg.data)).replaceAll("\n", "-NEW_LINE-"));
}