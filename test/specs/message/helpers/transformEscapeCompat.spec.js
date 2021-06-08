import transformEscape, { attachBase64Parser } from '../../../../src/app/message/helpers/transformEscapeCompat';

describe('transformEscapeCompat', () => {
    let getAttribute;

    const USER_INJECT = 'user.inject';

    const babase64 = `src="data:image/jpg;base64,iVBORw0KGgoAAAANSUhEUgAABoIAAAVSCAYAAAAisOk2AAAMS2lDQ1BJQ0MgUHJv
    ZmlsZQAASImVVwdYU8kWnltSSWiBUKSE3kQp0qWE0CIISBVshCSQUGJMCCJ2FlkF
    1y4ioK7oqoiLrgWQtaKudVHs/aGIysq6WLCh8iYF1tXvvfe9831z758z5/ynZO69
    MwDo1PKk0jxUF4B8SYEsITKUNTEtnUXqAgSgD1AwGozk8eVSdnx8DIAydP+nvLkO"`;

    const DOM = `<section>
    <svg id="svigi" width="5cm" height="4cm" version="1.1"
         xmlns="http://www.w3.org/2000/svg" xmlns:xlink= "http://www.w3.org/1999/xlink">
        <image xlink:href="firefox.jpg" x="0" y="0" height="50px" width="50px" />
        <image xlink:href="chrome.jpg" x="0" y="0" height="50px" width="50px" />
    </svg>
    <video src="fichiervideo.webm" autoplay poster="vignette.jpg">
    </video>
    <div>
        <img border="0" usemap="#fp"  src="cats.jpg ">
        <map name="fp">
            <area coords="0,0,800,800" href="proton_exploit.html" shape="rect" target="_blank" >
        </map>
    </div>

    <video src="fichiervideo.webm" autoplay poster="vignette2.jpg">
    </video>
    <img id="srcset1" src="mon-image.jpg" srcset="mon-imageHD.jpg 2x" width="" height="" alt="">
    <img id="srcset2" src="lol-image.jpg" srcset="lol-imageHD.jpg 2x" width="" height="" alt="">
    <img data-src="lol-image.jpg" width="" height="" alt="">
    <a href="lol-image.jpg">Alll</a>
    <a href="jeanne-image.jpg">Alll</a>
    <div background="jeanne-image.jpg">Alll</div>
    <div background="jeanne-image2.jpg">Alll</div>

    <img id="babase64" ${babase64}/>
</section>`;

    const CODE_HTML_HIGHLIGHT = `
    <div style="white-space: normal;" class="pre"><div style="color: #fff;max-width: 100%;font-size: 16px;line-height: 1.3;" class="code"><span style="color: #DDDDDF;" class="nt">&lt;script</span> <span style="color: #84868B;" class="na">src="</span><span style="color: #68BEA2;" class="s"><span class="s">https<span>://</span>use.fontawesome<span>.</span>com/f0d8991ea9.js</span><span style="color: #84868B;" class="na">"</span><span style="color: #DDDDDF;" class="nt">&gt;</span><span style="color: #DDDDDF;" class="nt">&lt;/script&gt;</span></span></div></div><div class="pre"></div>
`;
    const HTML_LINKS = `<div>
  <a href="http://www.dewdwesrcset-dewdw.com/?srcset=de&srcset=Dewdwe"></a>
  <a href="http://www.dewdwesrc-dewdw.com/?src=de&src=Dewdwe"></a>
  <a href="http://www.dewdwebackground-dewdw.com/?background=de&background=Dewdwe"></a>
  <a href="http://www.dewdweposter-dewdw.com/?poster=de&poster=Dewdwe"></a>
  <a href="http://www.google.nl/?url=a"></a>
  <a href="http://www.google.nl/?src=a&srcset=dew"></a>
</div>`;
    const CODE_HTML = '<pre><code><img src="polo.fr"></code></pre>';
    const CODE_HTML_ESCAPED = '<pre><code><img proton-src="polo.fr"></code></pre>';
    const CODE_TEXT = '<pre><code>{ background: url(\'monique.jpg\') }</code></pre>';
    const TEXT = '<p>salut monique est ceque tu as un src="lol" dans la poche ?</p><span>src=</span>';
    const EDGE_CASE = '<div id="ymail_android_signature"><a href="https://overview.mail.yahoo.com/mobile/?.src=Android">Sent from Yahoo Mail on Android</a></div>';
    const EDGE_CASE_2 = `
        webEngineView->setUrl("
        <span>webEngineView->setUrl("</span>
        <div>webEngineView->setUrl("</div>
        <pre>webEngineView->setUrl("</pre>
        <code>webEngineView->setUrl(".</code>`;

    const EX_URL = '<div style="background: url(\'https://i.imgur.com/WScAnHr.jpg\')">ddewdwed</div>';
    const EX_URL_CLEAN = '<div style="background: proton-url(\'https://i.imgur.com/WScAnHr.jpg\')">ddewdwed</div>';
    const BACKGROUND_URL = `
        <div style="background: url('https://i.imgur.com/WScAnHr.jpg')">ddewdwed</div>
        <div style="color: red; background: #ffffff url('https://i.imgur.com/WScAnHr.jpg')">ddewdwed</div>
        <div style="color: red; background:    url('https://i.imgur.com/WScAnHr.jpg')">ddewdwed</div>
        <div style="color: red; background:url('https://i.imgur.com/WScAnHr.jpg')">ddewdwed</div>
        <span style="color: red; background:url('https://i.imgur.com/WScAnHr.jpg')">ddewdwed</span>`;
    const BACKGROUND_URL_ESCAPED_WTF =
        '<div style="width: 500px; height: 500px; background:u\\rl(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>';

    // DON'T REMOVE THEM
    const BACKGROUND_URL_ESCAPED_WTF2 = `
        <div style="width: 500px; height: 500px; background:ur\l(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>
        <div style="width: 500px; height: 500px; background:u\&#114;l(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>
        <div style="width: 500px; height: 500px; background:ur\&#108;(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>
    `;
    const BACKGROUND_URL_ESCAPED = `
        <div style="width: 500px; height: 500px; background:&#117;rl(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>
        <div style="width: 500px; height: 500px; background:&#117;rl(&quot;https://i.imgur.com/WScAnHr.jpg&quot;)">ddewdwed</div>
        <div style="width: 500px; height: 500px; background:&#117;rl(&apos;https://i.imgur.com/WScAnHr.jpg&apos;)">ddewdwed</div>
        <div style="width: 500px; height: 500px; content: &quot; ass &quot;; background:url(https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 500px; content: &quot; ass &quot;; background:url(https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 120px; content: &quot; ass &quot;; background:&#117;&#114;&#108;(https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 120px; content: &quot; ass &quot;; background:&#117;r&#108;(https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 120px; content: &quot; ass &quot;; background: u&#114l(https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 500px; content: &quot; ass &quot;; background:url&#x00028;https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 500px; content: &quot; ass &quot;; background:url&lpar;https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        <div style="width: 500px; height: 456px; content: &quot; ass &quot;; background:url&#40;https://i.imgur.com/WScAnHr.jpg);">ddewdwed</div>
        `;

    const BACKGROUND_URL_OCTAL_HEX_ENCODING = `
        <div style="background: \\75&#114\\6C('https://TRACKING1/')">test1</div>
        <div style="background: \\75&#114;\\6C('https://TRACKING2/')">test2</div>
        <div style="background: \\75r&#108('https://TRACKING3/')">test3</div>
        <div style="background: &#117r\\6c('https://TRACKING4/')">test4</div>
        <div style="background: \\75 \\72 \\6C ('https://TRACKING5/')">test5</div>
        <div style="background: \\75\\72\\6c ('https://TRACKING6/')">test6</div>
        <div style="background: \\75\\72\\6C('https://TRACKING7/')">test7</div>
        <div style="background: \\75\\72\\6c('https://TRACKING8/')">test8</div>
        <div style="background: \x75\x72\x6C('https://TRACKING9/')">test9</div>
        <div style="background: \u0075\u0072\u006c('https://TRACKING10/')">test10</div>
        <div style="background: &#x75r\\6c('https://TRACKING11/')">test11</div>
        <div style="background: \\75&#x72;\\6C('https://TRACKING12/')">test12</div>
        <div style="background: \\75r&#x6c;('https://TRACKING12/')">test13</div>
        `;

    const BACKGROUND_URL_SAFE = `
        <span>url('dewd')</span>
        <span>style="dewdw" url('dewd')</span>
        <span>dew style="dewdw" url('dewd')</span>
        <span>dew style="dewdw": url(</span>
        <span>dew style="content: \\"a\\"": url(</span>
        <span>dew style="content: 'a": url(</span>
        <span>dew style="content: \\"a": url(</span>
        <div style="width: 500px; height: 500px; content: &quot; background:url(test)&quot;">ddewdwed</div>
        <div style="width: 500px; height: 500px; content: &apos; background:url(test)&apos;">ddewdwed</div>`;

    let output;

    const cache = {
        map: Object.create(null),
        put(key, value) {
            this.map[key] = value;
        },
        get(key) {
            return this.map[key];
        },
        size() {
            return Object.keys(this.map);
        },
        readMap() {
            return this.map;
        },
        removeAll() {
            this.map = Object.create(null);
        }
    };

    describe('Replace base64', () => {
        describe('No syntax hightlighting', () => {
            beforeEach(() => {
                cache.removeAll();
                output = transformEscape(DOM, {
                    activeCache: true,
                    cache
                });
            });

            it('should remove the base64 from src', () => {
                expect(output.querySelector('#babase64').src).toBe('');
                expect(output.querySelector('#babase64').hasAttribute('src')).toBe(false);
            });

            it('should add a custom marker attribute', () => {
                expect(output.querySelector('#babase64').hasAttribute('data-proton-replace-base')).toBe(true);
                expect(output.querySelector('#babase64').getAttribute('data-proton-replace-base')).not.toBe('');
            });

            it('should add a custom marker attribute with a hash available inside the cache', () => {
                const [ hash ] = Object.keys(cache.readMap());
                expect(output.querySelector('#babase64').getAttribute('data-proton-replace-base')).toBe(hash);
                expect(cache.get(hash)).toBe(babase64);
            });

            it('should attach the base64', () => {
                const html = attachBase64Parser(output, cache);
                const dom = document.createElement('DIV');
                dom.innerHTML = html;

                expect(dom.querySelector('#babase64').hasAttribute('data-proton-replace-base')).toBe(false);
                expect(dom.querySelector('#babase64').hasAttribute('src')).toBe(true);

                const value = babase64.replace(/^src="/, '').slice(0, 20);
                expect(dom.querySelector('#babase64').src.startsWith(value)).toBe(true);
            });
        });

        describe('Syntax hightlighting', () => {
            beforeEach(() => {
                output = transformEscape(CODE_HTML_HIGHLIGHT, {
                    activeCache: false
                });
            });

            it('should not escape inside a <code> tag', () => {
                expect(output.innerHTML).not.toMatch(/proton-/);
            });
        });
    });

    describe('Escape <pre>', () => {
        describe('No syntax hightlighting', () => {
            beforeEach(() => {
                output = transformEscape(CODE_HTML, {
                    activeCache: false
                }).querySelector('body');
            });

            it('should escape inside a <code> tag', () => {
                expect(output.innerHTML).toBe(CODE_HTML_ESCAPED);
            });

            it('should not escape text inside a <code> tag', () => {
                const demo = transformEscape(CODE_TEXT).querySelector('body');
                expect(demo.innerHTML).toBe(CODE_TEXT);
            });
        });

        describe('Syntax hightlighting', () => {
            beforeEach(() => {
                output = transformEscape(CODE_HTML_HIGHLIGHT, {
                    activeCache: false
                });
            });

            it('should not escape inside a <code> tag', () => {
                expect(output.innerHTML).not.toMatch(/proton-/);
            });
        });
    });

    describe('Escape everything with proton-', () => {
        beforeEach(() => {
            output = transformEscape(DOM, {
                activeCache: false
            });
            getAttribute = (attribute) => {
                return [].slice.call(output.querySelectorAll(`[${attribute}]`));
            };
        });

        describe('Add a prefix', () => {
            it('should not add the prefix before href', () => {
                const list = getAttribute('proton-href');
                expect(list.length).toBe(0);
            });

            it('should add the prefix before src', () => {
                const list = getAttribute('proton-src');
                expect(list.length).toBe(5);
            });



            it('should add the prefix for SVG', () => {
                const list = output.querySelectorAll('proton-svg');
                expect(list.length).toBe(1);
            });

        });

        describe('Excape all the things !', () => {
            it('should have escaped every src', () => {
                const list = getAttribute('src');
                expect(list.length).toBe(0);
            });

            it('should have escaped every srcset', () => {
                const list = getAttribute('srcset');
                expect(list.length).toBe(0);
            });

            it('should have escaped every background', () => {
                const list = getAttribute('background');
                expect(list.length).toBe(0);
            });

            it('should have escaped every poster', () => {
                const list = getAttribute('poster');
                expect(list.length).toBe(0);
            });

            it('should have escaped every SVG', () => {
                const list = output.querySelectorAll('svg');
                expect(list.length).toBe(0);
            });
        });

        it('should correctly escape svg', () => {
            expect(output.innerHTML).toMatch(/\/proton-svg>/);
            expect(output.innerHTML).toMatch(/<proton-svg/);
        });
    });

    describe('No escape inside URL', () => {
        beforeEach(() => {
            output = transformEscape(HTML_LINKS, {
                activeCache: false
            });
        });

        it('should not escape the content of an anchor tag', () => {
            expect(output.innerHTML).not.toMatch(/proton-/);
        });
    });

    describe('No escape TXT', () => {
        beforeEach(() => {
            output = transformEscape(TEXT, {
                activeCache: false
            });
        });

        it('should not escape txt', () => {
            expect(output.innerHTML).not.toMatch(/proton-/);
        });
    });

    describe('No escape EDGE_CASE', () => {
        beforeEach(() => {
            output = transformEscape(EDGE_CASE, {
                activeCache: false
            });
        });

        it('should not escape EDGE_CASE', () => {
            expect(output.innerHTML).not.toMatch(/proton-/);
        });
    });

    describe('No escape EDGE_CASE2', () => {
        beforeEach(() => {
            output = transformEscape(EDGE_CASE_2, {
                activeCache: false
            });
        });

        it('should not escape EDGE_CASE', () => {
            expect(output.innerHTML).not.toMatch(/proton-/);
        });
    });

    describe('No double escape', () => {
        beforeEach(() => {
            output = transformEscape(DOM, {
                activeCache: false
            });
            output = transformEscape(output.innerHTML);
        });

        it('should not double escape attributes', () => {
            expect(output.innerHTML).not.toMatch(/proton-proton-/);
        });
    });

    describe('Escape BACKGROUND_URL', () => {
        const getList = (input) => {
            return input.querySelector('body').innerHTML
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
        };

        it('should escape all', () => {
            const html = transformEscape(BACKGROUND_URL, {
                activeCache: false
            })
            const list = getList(html);

            list.forEach((key) => {
                expect(key).toMatch(/proton-/);
            });
        });

        it('should escape all encoded url', () => {
            const html = transformEscape(BACKGROUND_URL_ESCAPED, {
                activeCache: false
            });
            const list = getList(html);

            list.forEach((key) => {
                expect(key).toMatch(/proton-/);
            });
        });
        it('should escape encoded url with escape \\r', () => {
            const html = transformEscape(BACKGROUND_URL_ESCAPED_WTF, {
                activeCache: false
            });
            expect(html.innerHTML).toMatch(/proton-/);
        });

        it('should escape encoded url with escape standard wtf', () => {
            const html = transformEscape(BACKGROUND_URL_ESCAPED_WTF2, {
                activeCache: false
            });
            const list = getList(html);

            list.forEach((key) => {
                expect(key).toMatch(/proton-/);
            });
        });

        it('should escape octal and hex encoded urls with escape', () => {
            const html = transformEscape(BACKGROUND_URL_OCTAL_HEX_ENCODING, {
                activeCache: false
            });
            const list = getList(html);

            list.forEach((key) => {
                expect(key).toMatch(/proton-/);
            });
        });

        it('should not break the HTML', () => {
            const html = transformEscape(EX_URL, {
                activeCache: false
            }).querySelector('body');
            expect(html.innerHTML).toEqual(EX_URL_CLEAN);
        });
    });

    describe('no scape BACKGROUND_URL -> user.inject', () => {
        beforeEach(() => {
            output = transformEscape(BACKGROUND_URL, {
                action: USER_INJECT,
                activeCache: false
            });
        });

        it('should not escape anything', () => {
            expect(output.innerHTML).not.toMatch(/proton-/);
        });

        it('should not break the HTML', () => {
            const html = transformEscape(EX_URL, {
                action: USER_INJECT,
                activeCache: false
            });
            expect(html.innerHTML).not.toMatch(/proton-/);
        });
    });

    describe('Ǹot escape BACKGROUND_URL', () => {
        beforeEach(() => {
            output = transformEscape(BACKGROUND_URL_SAFE, {
                activeCache: false
            });
        });

        it('should not escape anything', () => {
            expect(output.BACKGROUND_URL_SAFE).not.toMatch(/proton-/);
        });
    });
});
