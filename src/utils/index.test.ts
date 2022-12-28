import {
  chunkStr,
  chunkArr,
  parseHeaderString,
  headerMapToArray,
  getFullNameFromEmailToStr,
} from './index'

describe('chunkStr', () => {
  it('creates chunks', () => {
    let str = '123456789'
    let chunks = chunkStr(str, 3)
    expect(chunks).toEqual(['123', '456', '789'])

    // array with 10000 elements
    str = new Array(10001).join('a')
    chunks = chunkStr(str, 2000)
    expect(chunks.length).toBe(5)
    chunks.forEach((chunk) => {
      expect(chunk.length).toBe(2000)
    })

    // array with 3290 elements
    str = new Array(3291).join('a')
    chunks = chunkStr(str, 1000)
    expect(chunks.length).toBe(4)
    chunks.forEach((chunk, i) => {
      if (i === 3) {
        expect(chunk.length).toBe(290)
        return
      }

      expect(chunk.length).toBe(1000)
    })
  })

  it('handles empty string', () => {
    let str = ''
    let chunks = chunkStr(str)
    expect(chunks).toEqual([''])
  })
})

describe('chunkArr', () => {
  it('creates chunks', () => {
    let input = new Array(300).fill(null)
    let chunks = chunkArr(input)

    expect(chunks.length).toEqual(3)

    for (let chunk of chunks) {
      expect(chunk.length).toEqual(100)
    }

    input = [1, 2, 3, 4, 5]
    chunks = chunkArr(input, 2)

    expect(chunks.length).toEqual(3)
    expect(chunks[0]).toEqual([1, 2])
    expect(chunks[1]).toEqual([3, 4])
    expect(chunks[2]).toEqual([5])
  })
})

const rawHeaders = [
  'Received: by mx0148p1mdw1.sendgrid.net with SMTP id nxZhrfOoV0 Mon, 23 May 2022 08:57:24 +0000 (UTC)',
  'Received: from mail-yw1-f169.google.com (unknown [209.85.128.169]) by mx0148p1mdw1.sendgrid.net (Postfix) with ESMTPS id 1F2561209A5 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 08:57:24 +0000 (UTC)',
  'Received: by mail-yw1-f169.google.com with SMTP id 00721157ae682-2fed823dd32so139749927b3.12 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 01:57:24 -0700 (PDT)',
  'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=hellodeco-so.20210112.gappssmtp.com; s=20210112; h=mime-version:references:in-reply-to:from:date:message-id:subject:to; bh=84K/KlXihohFPAS/rq5fulpyM2rQyBVH18CO6Z8IG0I=; b=WY1Ujfxp3PSoNWOPV4vEIAngmp7A21U7r/YUtzWgykiHV9vvScEaEuJp5ynvJ7Drej agIugxM+q7vtAF2MBuBOwMXRyV30yHo8UZZylpTYR0guKwfjlY2x5kfpb3ITRzhbYjSe H6RVirAWWU+u2cBeQMxAoYBahn6dibb3NuuYIVtvCpPHb3sYlZ9+L61v9qKifdKp+QZ4 DfJZqyojxrLPFiQ6NfEcy5kj/vghYBinvXxr2/v5I/+qU+Xu0fuD4ggjIbuosdlLJipk HGiQ3bpLcJpUS8DeKMJxBg/27YkxHHUrhSe2aa2FJx1/GWdXI51YU3IRaQ8a85WsYQt3 cAfQ==',
  'References: <CAFgx2peBGTVYEz-TT7vhjuPGASaDcPN3aou+rx3+G3f-dk+XMg@mail.gmail.com> <CAFgx2pfbdK4yp1Fu5ke1OjCok_RXjRCRVOja6PvmzSfcFzSsiw@mail.gmail.com> <CAFgx2pfW60FK3iUmn1d_tCatoOTGTsGeKQRz8Mf0xSVgE=eDow@mail.gmail.com> <CAFgx2pdfxyptx8bwwn6H=5Z+vvs-OC=Te0cfQEhz1R7wq5GVTg@mail.gmail.com> <CAFgx2pfDeh-H+HtRKjSpYQfpQP6jVPa5LYT9t_0djMgb+ZDeZw@mail.gmail.com>',
  'In-Reply-To: <CAFgx2pfDeh-H+HtRKjSpYQfpQP6jVPa5LYT9t_0djMgb+ZDeZw@mail.gmail.com>',
  'From: Matt Ehlinger <matt@hellodeco.so>',
  'Date: Mon, 23 May 2022 10:57:13 +0200',
  'Message-ID: <CAFgx2pd4=fQfqC5SjsPTuQ3Jr+xpfQ+vcOdAnx3ibH03UpTWog@mail.gmail.com>',
  'Subject: Re: Hello',
  'To: matt@mail.crankywidgets.com',
  'Content-Type: multipart/alternative; boundary="0000000000004f834f05dfaa0749"',
].join('\n')

describe('parseHeaderString', () => {
  it('parses things correctly', () => {
    const headersMap = parseHeaderString(rawHeaders)

    expect(headersMap.received).toEqual(
      expect.arrayContaining([
        'by mx0148p1mdw1.sendgrid.net with SMTP id nxZhrfOoV0 Mon, 23 May 2022 08:57:24 +0000 (UTC)',
        'from mail-yw1-f169.google.com (unknown [209.85.128.169]) by mx0148p1mdw1.sendgrid.net (Postfix) with ESMTPS id 1F2561209A5 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 08:57:24 +0000 (UTC)',
        'by mail-yw1-f169.google.com with SMTP id 00721157ae682-2fed823dd32so139749927b3.12 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 01:57:24 -0700 (PDT)',
      ]),
    )

    expect(headersMap.references).toEqual([
      '<CAFgx2peBGTVYEz-TT7vhjuPGASaDcPN3aou+rx3+G3f-dk+XMg@mail.gmail.com> <CAFgx2pfbdK4yp1Fu5ke1OjCok_RXjRCRVOja6PvmzSfcFzSsiw@mail.gmail.com> <CAFgx2pfW60FK3iUmn1d_tCatoOTGTsGeKQRz8Mf0xSVgE=eDow@mail.gmail.com> <CAFgx2pdfxyptx8bwwn6H=5Z+vvs-OC=Te0cfQEhz1R7wq5GVTg@mail.gmail.com> <CAFgx2pfDeh-H+HtRKjSpYQfpQP6jVPa5LYT9t_0djMgb+ZDeZw@mail.gmail.com>',
    ])

    expect(headersMap['in-reply-to']).toEqual([
      '<CAFgx2pfDeh-H+HtRKjSpYQfpQP6jVPa5LYT9t_0djMgb+ZDeZw@mail.gmail.com>',
    ])
  })
})

describe('headerMapToArray', () => {
  it('converts a map to an array as expected', () => {
    const headerMap = {
      received: [
        'by mx0148p1mdw1.sendgrid.net with SMTP id nxZhrfOoV0 Mon, 23 May 2022 08:57:24 +0000 (UTC)',
        'from mail-yw1-f169.google.com (unknown [209.85.128.169]) by mx0148p1mdw1.sendgrid.net (Postfix) with ESMTPS id 1F2561209A5 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 08:57:24 +0000 (UTC)',
        'by mail-yw1-f169.google.com with SMTP id 00721157ae682-2fed823dd32so139749927b3.12 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 01:57:24 -0700 (PDT)',
      ],
      from: ['Matt Ehlinger <matt@hellodeco.so>'],
    }

    const headers = headerMapToArray(headerMap, 1)

    expect(headers).toEqual(
      expect.arrayContaining([
        {
          key: 'received',
          value:
            'by mx0148p1mdw1.sendgrid.net with SMTP id nxZhrfOoV0 Mon, 23 May 2022 08:57:24 +0000 (UTC)',
          emailId: 1,
        },
        {
          key: 'received',
          value:
            'from mail-yw1-f169.google.com (unknown [209.85.128.169]) by mx0148p1mdw1.sendgrid.net (Postfix) with ESMTPS id 1F2561209A5 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 08:57:24 +0000 (UTC)',
          emailId: 1,
        },
        {
          key: 'received',
          value:
            'by mail-yw1-f169.google.com with SMTP id 00721157ae682-2fed823dd32so139749927b3.12 for <matt@mail.crankywidgets.com>; Mon, 23 May 2022 01:57:24 -0700 (PDT)',
          emailId: 1,
        },
        {
          key: 'from',
          value: 'Matt Ehlinger <matt@hellodeco.so>',
          emailId: 1,
        },
      ]),
    )
  })
})

describe.only('getFullNameFromEmailToStr', () => {
  it('returns the full name from an email string', () => {
    const fullName = getFullNameFromEmailToStr('Matt Ehlinger <matt@deco.so>')

    expect(fullName).toEqual('Matt Ehlinger')
  })
})
